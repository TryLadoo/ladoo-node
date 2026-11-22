import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_VERSION,
  APIConnectionError,
  APITimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  Ladoo,
  LadooError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
} from "../src/index.js";
import { callDetail, person } from "./fixtures.js";
import { apiError, json, mockClient } from "./helpers.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("configuration", () => {
  it("reads LADOO_API_KEY when no key is passed", async () => {
    vi.stubEnv("LADOO_API_KEY", "lsk_from_env");
    let auth: string | null = null;
    const ladoo = new Ladoo({
      fetch: async (_url, init) => {
        auth = new Headers(init?.headers).get("authorization");
        return json(callDetail);
      },
    });
    await ladoo.calls.retrieve(callDetail.id);
    expect(auth).toBe("Bearer lsk_from_env");
  });

  it("throws a clear error without a key", () => {
    vi.stubEnv("LADOO_API_KEY", "");
    expect(() => new Ladoo()).toThrow(/Missing API key/);
  });

  it("sends auth, version and user agent headers", async () => {
    const { ladoo, requests } = mockClient(() => json(callDetail));
    await ladoo.calls.retrieve(callDetail.id);
    const [req] = requests;
    expect(req?.method).toBe("GET");
    expect(req?.url.href).toBe(`https://api.tryladoo.com/v1/calls/${callDetail.id}`);
    expect(req?.headers.get("authorization")).toBe("Bearer lsk_demo_test");
    expect(req?.headers.get("ladoo-version")).toBe(API_VERSION);
    expect(req?.headers.get("user-agent")).toMatch(/^ladoo-node\//);
    expect(req?.headers.get("idempotency-key")).toBeNull();
  });

  it("honors baseUrl, apiVersion and per-request overrides", async () => {
    const { ladoo, requests } = mockClient(() => json(callDetail), {
      baseUrl: "https://ladoo.example.com/",
      apiVersion: "2026-11-16",
    });
    await ladoo.calls.retrieve("abc", { apiVersion: "2027-01-01", headers: { "X-Trace": "1" } });
    expect(requests[0]?.url.href).toBe("https://ladoo.example.com/v1/calls/abc");
    expect(requests[0]?.headers.get("ladoo-version")).toBe("2027-01-01");
    expect(requests[0]?.headers.get("x-trace")).toBe("1");
  });

  it("encodes path parameters", async () => {
    const { ladoo, requests } = mockClient(() => json(callDetail));
    await ladoo.calls.retrieve("a/b c");
    expect(requests[0]?.url.pathname).toBe("/v1/calls/a%2Fb%20c");
  });
});

describe("requests", () => {
  it("serializes query parameters and skips undefined ones", async () => {
    const { ladoo, requests } = mockClient(() => json({ data: [], next_cursor: null }));
    await ladoo.calls.list({ outcome: "booked", limit: 50, from: undefined, hung_up_early: "false" });
    const params = requests[0]?.url.searchParams;
    expect(params?.get("outcome")).toBe("booked");
    expect(params?.get("limit")).toBe("50");
    expect(params?.get("hung_up_early")).toBe("false");
    expect(params?.has("from")).toBe(false);
  });

  it("sends JSON bodies with an automatic Idempotency-Key on POST", async () => {
    const { ladoo, requests } = mockClient(() => json(person, { status: 201 }));
    const created = await ladoo.people.create({ name: "Jordan Rivera", phone: "+15555550100" });
    expect(created).toEqual(person);
    const req = requests[0];
    expect(req?.method).toBe("POST");
    expect(req?.headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(req?.body))).toEqual({ name: "Jordan Rivera", phone: "+15555550100" });
    expect(req?.headers.get("idempotency-key")).toMatch(/^ladoo-node-[0-9a-f-]{36}$/);
  });

  it("uses an Idempotency-Key you pass", async () => {
    const { ladoo, requests } = mockClient(() => json(person, { status: 201 }));
    await ladoo.people.create({ name: "Jordan Rivera" }, { idempotencyKey: "import-row-42" });
    expect(requests[0]?.headers.get("idempotency-key")).toBe("import-row-42");
  });

  it("sends {} for a POST whose body is optional", async () => {
    const { ladoo, requests } = mockClient(() => json({ id: "run" }, { status: 201 }));
    await ladoo.agents.tests.createRun("agent-1");
    expect(requests[0]?.body).toBe("{}");
  });

  it("resolves 204 responses to undefined", async () => {
    const { ladoo, requests } = mockClient(() => new Response(null, { status: 204 }));
    await expect(ladoo.people.delete(person.id)).resolves.toBeUndefined();
    expect(requests[0]?.method).toBe("DELETE");
  });

  it("returns binary responses as an ArrayBuffer", async () => {
    const { ladoo } = mockClient(
      () => new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } }),
    );
    const audio = await ladoo.voices.speech("voice-1", { text: "Thanks for calling." });
    expect(new Uint8Array(audio)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("sends file uploads as multipart form data", async () => {
    const { ladoo, requests } = mockClient(() => json({ id: "script-1" }, { status: 201 }));
    const file = new File(["Hello, thanks for calling."], "greeting.txt", { type: "text/plain" });
    await ladoo.scripts.upload({ file, name: "Greeting" });
    const body = requests[0]?.body;
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    expect((form.get("file") as File).name).toBe("greeting.txt");
    expect(form.get("name")).toBe("Greeting");
    expect(requests[0]?.headers.get("content-type")).toBeNull();
  });

  it("exposes a raw request method for endpoints the SDK doesn't cover", async () => {
    const { ladoo, requests } = mockClient(() => json({ ok: true }));
    const res = await ladoo.request<{ ok: boolean }>({ method: "GET", path: "/v1/new-thing", query: { a: 1 } });
    expect(res.ok).toBe(true);
    expect(requests[0]?.url.search).toBe("?a=1");
  });
});

describe("errors", () => {
  it.each([
    [400, "validation_failed", BadRequestError],
    [401, "unauthorized", AuthenticationError],
    [403, "insufficient_scope", PermissionDeniedError],
    [404, "not_found", NotFoundError],
    [409, "conflict", ConflictError],
  ])("maps %i %s to %o without retrying", async (status, code, ErrorClass) => {
    const { ladoo, requests } = mockClient(() => apiError(status, code));
    const error = await ladoo.calls.retrieve("missing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toBeInstanceOf(LadooError);
    expect(error).toMatchObject({ status, code, requestId: "6b1f0c2e-9d4a-4f3b-8e7c-5a2d1b0c9e8f" });
    expect(requests).toHaveLength(1);
  });

  it("carries details", async () => {
    const { ladoo } = mockClient(() =>
      json(
        { error: { code: "insufficient_scope", message: "m", details: { required: "people:write" }, request_id: "r" } },
        { status: 403 },
      ),
    );
    await expect(ladoo.people.create({ name: "Demo" })).rejects.toMatchObject({
      details: { required: "people:write" },
    });
  });

  it("handles error bodies that aren't JSON", async () => {
    const { ladoo } = mockClient(() => new Response("Bad gateway", { status: 400 }));
    const error = await ladoo.workspace.retrieve().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestError);
    expect(error).toMatchObject({ code: "http_400", requestId: undefined });
  });
});

describe("retries", () => {
  it("retries a 429 after Retry-After and reuses the Idempotency-Key", async () => {
    vi.useFakeTimers();
    const { ladoo, requests } = mockClient((_req, attempt) =>
      attempt === 0 ? apiError(429, "rate_limited", { "Retry-After": "2" }) : json(person, { status: 201 }),
    );
    const promise = ladoo.people.create({ name: "Demo" });
    await vi.advanceTimersByTimeAsync(1999);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toEqual(person);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get("idempotency-key")).toBe(requests[0]?.headers.get("idempotency-key"));
  });

  it("throws RateLimitError with retryAfter once retries run out", async () => {
    const { ladoo, requests } = mockClient(() => apiError(429, "rate_limited", { "Retry-After": "0" }));
    const error = await ladoo.calls.retrieve("x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(0);
    expect(requests).toHaveLength(3);
  });

  it("doesn't wait out a Retry-After longer than a minute", async () => {
    const { ladoo, requests } = mockClient(() => apiError(429, "rate_limited", { "Retry-After": "3600" }));
    await expect(ladoo.calls.retrieve("x")).rejects.toBeInstanceOf(RateLimitError);
    expect(requests).toHaveLength(1);
  });

  it("retries 5xx with backoff", async () => {
    vi.useFakeTimers();
    const { ladoo, requests } = mockClient((_req, attempt) =>
      attempt < 2 ? apiError(503, "provider_unavailable") : json(callDetail),
    );
    const promise = ladoo.calls.retrieve("x");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual(callDetail);
    expect(requests).toHaveLength(3);
  });

  it("retries idempotency_key_in_use", async () => {
    vi.useFakeTimers();
    const { ladoo, requests } = mockClient((_req, attempt) =>
      attempt === 0 ? apiError(409, "idempotency_key_in_use") : json(person, { status: 201 }),
    );
    const promise = ladoo.people.create({ name: "Demo" });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual(person);
    expect(requests).toHaveLength(2);
  });

  it("throws InternalServerError when 5xx persists", async () => {
    vi.useFakeTimers();
    const { ladoo } = mockClient(() => apiError(500, "internal_error"), { maxRetries: 1 });
    const promise = ladoo.calls.retrieve("x").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    expect(await promise).toBeInstanceOf(InternalServerError);
  });

  it("retries network errors, then throws APIConnectionError", async () => {
    vi.useFakeTimers();
    const { ladoo, requests } = mockClient(() => {
      throw new TypeError("fetch failed");
    });
    const promise = ladoo.calls.retrieve("x").catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const error = await promise;
    expect(error).toBeInstanceOf(APIConnectionError);
    expect((error as Error).cause).toBeInstanceOf(TypeError);
    expect(requests).toHaveLength(3);
  });

  it("respects maxRetries: 0", async () => {
    const { ladoo, requests } = mockClient(() => apiError(503, "provider_unavailable"), { maxRetries: 0 });
    await expect(ladoo.calls.retrieve("x")).rejects.toBeInstanceOf(InternalServerError);
    expect(requests).toHaveLength(1);
  });
});

describe("timeouts and aborts", () => {
  const hang = (req: { signal?: AbortSignal | null }) =>
    new Promise<Response>((_resolve, reject) => {
      req.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });

  it("times out each attempt", async () => {
    const ladoo = new Ladoo({
      apiKey: "lsk_demo_test",
      timeout: 20,
      maxRetries: 0,
      fetch: (_url, init) => hang({ signal: init?.signal ?? null }),
    });
    await expect(ladoo.calls.retrieve("x")).rejects.toBeInstanceOf(APITimeoutError);
  });

  it("stops when your signal aborts, without retrying", async () => {
    let calls = 0;
    const ladoo = new Ladoo({
      apiKey: "lsk_demo_test",
      fetch: (_url, init) => {
        calls++;
        return hang({ signal: init?.signal ?? null });
      },
    });
    const controller = new AbortController();
    const promise = ladoo.calls.retrieve("x", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(APIUserAbortError);
    expect(calls).toBe(1);
  });
});
