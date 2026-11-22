import { type ListBody, Page, PagePromise, type QueryValue, type RequestSpec } from "./core.js";
import {
  APIConnectionError,
  APIError,
  type APIErrorBody,
  APITimeoutError,
  APIUserAbortError,
  LadooError,
} from "./errors.js";
import { LadooResources } from "./generated/resources.js";
import { API_VERSION } from "./generated/types.js";
import { randomUUID } from "./internal/crypto.js";
import { VERSION } from "./version.js";

export interface ClientOptions {
  /** Your API key (`lsk_…`). Defaults to the `LADOO_API_KEY` environment variable. */
  apiKey?: string | undefined;
  /**
   * The dated API version to send as `Ladoo-Version`. Defaults to the version
   * this SDK's types were generated from, so responses match the types.
   */
  apiVersion?: string;
  /** Defaults to `https://api.tryladoo.com`. */
  baseUrl?: string;
  /** Retries for 429s, 5xx responses and network errors. Defaults to 2. */
  maxRetries?: number;
  /** Timeout for each attempt, in milliseconds. Defaults to 60 seconds. */
  timeout?: number;
  /** A `fetch` to use instead of the global one, for proxies, tests or tracing. */
  fetch?: typeof fetch;
  /** Headers sent with every request. */
  defaultHeaders?: Record<string, string>;
}

const DEFAULT_BASE_URL = "https://api.tryladoo.com";
const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY = 60;

/**
 * The Ladoo API client.
 *
 * ```ts
 * const ladoo = new Ladoo(); // reads LADOO_API_KEY
 * const call = await ladoo.calls.retrieve("c2a1e9b8-…");
 * ```
 */
export class Ladoo extends LadooResources {
  readonly apiVersion: string;
  readonly baseUrl: string;
  readonly maxRetries: number;
  readonly timeout: number;

  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #defaultHeaders: Record<string, string>;

  constructor(options: ClientOptions = {}) {
    super();
    const apiKey = options.apiKey ?? readEnv("LADOO_API_KEY");
    if (!apiKey) {
      throw new LadooError(
        "Missing API key. Pass `apiKey` to `new Ladoo()` or set the LADOO_API_KEY environment variable.",
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new LadooError("No global `fetch` found. Use Node.js 18 or later, or pass `fetch` to `new Ladoo()`.");
    }
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
    this.#defaultHeaders = options.defaultHeaders ?? {};
    this.apiVersion = options.apiVersion ?? API_VERSION;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Sends a request to any endpoint, for one the SDK doesn't cover yet.
   * Retries, idempotency keys and errors work as for every other method.
   *
   * ```ts
   * const workspace = await ladoo.request<{ name: string }>({ method: "GET", path: "/v1/workspace" });
   * ```
   */
  async request<T>(spec: RequestSpec): Promise<T> {
    const response = await this.#send(spec);
    return (await parseBody(response, spec.responseType ?? "json")) as T;
  }

  /** @internal */
  requestPage<T>(spec: RequestSpec): PagePromise<T> {
    const load = async (cursor?: string): Promise<Page<T>> => {
      const query = cursor === undefined ? spec.query : { ...spec.query, cursor };
      const body = await this.request<ListBody<T>>({ ...spec, query });
      return new Page<T>(body, (next) => load(next));
    };
    return new PagePromise(() => load());
  }

  async #send(spec: RequestSpec): Promise<Response> {
    const options = spec.options ?? {};
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const timeout = options.timeout ?? this.timeout;
    const url = this.#url(spec.path, spec.query);

    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.#apiKey}`,
      "Ladoo-Version": options.apiVersion ?? this.apiVersion,
      "User-Agent": `ladoo-node/${VERSION}`,
      ...this.#defaultHeaders,
    };
    if (spec.method === "POST") {
      // One key for every attempt, so a retry after a lost response can't create twice.
      headers["Idempotency-Key"] = options.idempotencyKey ?? `ladoo-node-${await randomUUID()}`;
    }
    let body: BodyInit | undefined;
    if (spec.multipart !== undefined) {
      body = toFormData(spec.multipart);
    } else if (spec.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(spec.body);
    }
    Object.assign(headers, options.headers);

    for (let attempt = 0; ; attempt++) {
      if (options.signal?.aborted) throw new APIUserAbortError();
      const retriesLeft = maxRetries - attempt;
      let response: Response;
      try {
        response = await this.#fetchWithTimeout(url, { method: spec.method, headers, body }, timeout, options.signal);
      } catch (error) {
        if (error instanceof APIUserAbortError) throw error;
        if (retriesLeft > 0) {
          await sleep(backoff(attempt), options.signal);
          continue;
        }
        if (error instanceof APITimeoutError) throw error;
        throw new APIConnectionError(undefined, { cause: error });
      }

      if (response.ok) return response;

      const error = await toAPIError(response);
      const delay = retryDelay(error, attempt);
      if (retriesLeft > 0 && delay !== null) {
        await sleep(delay, options.signal);
        continue;
      }
      throw error;
    }
  }

  async #fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout: number,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    try {
      return await this.#fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (signal?.aborted) throw new APIUserAbortError();
      if (timedOut) throw new APITimeoutError(timeout);
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  #url(path: string, query: object | undefined): string {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query) as [string, QueryValue][]) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }
}

function readEnv(name: string): string | undefined {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.[name]?.trim() || undefined;
}

function toFormData(fields: object): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (value instanceof Blob) {
      const name = "name" in value && typeof value.name === "string" ? value.name : key;
      form.append(key, value, name);
    } else {
      form.append(key, String(value));
    }
  }
  return form;
}

async function parseBody(response: Response, type: "json" | "arrayBuffer" | "empty"): Promise<unknown> {
  if (type === "arrayBuffer") return response.arrayBuffer();
  const text = await response.text();
  if (type === "empty" || response.status === 204 || text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LadooError(`Expected JSON from the Ladoo API, got: ${text.slice(0, 200)}`, { cause });
  }
}

async function toAPIError(response: Response): Promise<APIError> {
  const text = await response.text().catch(() => "");
  let body: Partial<APIErrorBody> | undefined;
  try {
    body = (JSON.parse(text) as { error?: Partial<APIErrorBody> }).error;
  } catch {
    body = undefined;
  }
  return APIError.from(response.status, body, response.headers, text.slice(0, 200) || response.statusText);
}

/** Seconds to wait before retrying, or `null` if the error shouldn't be retried. */
function retryDelay(error: APIError, attempt: number): number | null {
  const { status } = error;
  // idempotency_key_in_use: the first attempt with this key is still running.
  const retryable = status === 429 || status >= 500 || error.code === "idempotency_key_in_use";
  if (!retryable) return null;
  const retryAfter = parseRetryAfter(error.headers.get("retry-after"));
  if (retryAfter === null) return backoff(attempt);
  return retryAfter <= MAX_RETRY_DELAY ? retryAfter : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, (date - Date.now()) / 1000);
}

/** Exponential backoff with jitter: about 0.5s, 1s, 2s... capped at 8s. */
function backoff(attempt: number): number {
  const base = Math.min(0.5 * 2 ** attempt, 8);
  return base * (0.75 + Math.random() * 0.25);
}

function sleep(seconds: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new APIUserAbortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(new APIUserAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, seconds * 1000);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
