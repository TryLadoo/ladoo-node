/** Per-request options. Every SDK method takes these as its last argument. */
export interface RequestOptions {
  /** Extra headers for this request. */
  headers?: Record<string, string>;
  /** Abort the request, including any retries still to come. */
  signal?: AbortSignal;
  /** Timeout for each attempt, in milliseconds. Overrides the client's `timeout`. */
  timeout?: number;
  /** How many times to retry this request. Overrides the client's `maxRetries`. */
  maxRetries?: number;
  /**
   * The `Idempotency-Key` to send on a `POST`. The SDK makes one for every `POST`
   * and reuses it on retries; pass your own to make a request safe to repeat
   * across processes, like a job that may run twice.
   */
  idempotencyKey?: string;
  /** Pin this request to another dated API version. Overrides the client's `apiVersion`. */
  apiVersion?: string;
}

export type QueryValue = string | number | boolean | null | undefined;

/** @internal The shape generated resource methods hand to the client. */
export interface RequestSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: object | undefined;
  body?: unknown;
  multipart?: object | undefined;
  responseType?: "json" | "arrayBuffer" | "empty";
  options?: RequestOptions | undefined;
}

/** @internal */
export interface Requester {
  request<T>(spec: RequestSpec): Promise<T>;
  requestPage<T>(spec: RequestSpec): PagePromise<T>;
}

/** @internal Base class of every resource namespace. */
export abstract class APIResource {
  /** @internal */
  protected readonly _client: Requester;

  constructor(client: Requester) {
    this._client = client;
  }
}

/** @internal */
export function encodePath(value: string | number): string {
  return encodeURIComponent(String(value));
}

/** @internal */
export interface ListBody<T> {
  data: T[];
  next_cursor: string | null;
  [key: string]: unknown;
}

/**
 * One page of a cursor-paginated list.
 *
 * Iterate it with `for await` to walk every item from this page on, fetching
 * the next pages as needed.
 */
export class Page<T> implements AsyncIterable<T> {
  /** The items on this page. */
  readonly data: T[];
  /** The cursor for the next page, or `null` on the last page. */
  readonly nextCursor: string | null;
  /** The full response body, including any fields beyond `data` and `next_cursor`. */
  readonly body: ListBody<T>;

  readonly #fetchPage: (cursor: string) => Promise<Page<T>>;

  /** @internal */
  constructor(body: ListBody<T>, fetchPage: (cursor: string) => Promise<Page<T>>) {
    this.body = body;
    this.data = body.data;
    this.nextCursor = body.next_cursor ?? null;
    this.#fetchPage = fetchPage;
  }

  hasNextPage(): boolean {
    return this.nextCursor !== null;
  }

  /** Fetches the next page. Throws on the last page; check `hasNextPage()` first. */
  getNextPage(): Promise<Page<T>> {
    if (this.nextCursor === null) {
      return Promise.reject(new Error("This is the last page: there is no next page to fetch."));
    }
    return this.#fetchPage(this.nextCursor);
  }

  /** Walks this page and every page after it. */
  async *pages(): AsyncGenerator<Page<T>, void, undefined> {
    let page: Page<T> = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    for await (const page of this.pages()) {
      yield* page.data;
    }
  }
}

/**
 * What a list method returns: `await` it for the first {@link Page}, or
 * `for await` over it for every item across all pages.
 */
export class PagePromise<T> implements PromiseLike<Page<T>>, AsyncIterable<T> {
  readonly #load: () => Promise<Page<T>>;
  #promise: Promise<Page<T>> | undefined;

  /** @internal */
  constructor(load: () => Promise<Page<T>>) {
    this.#load = load;
  }

  #page(): Promise<Page<T>> {
    this.#promise ??= this.#load();
    return this.#promise;
  }

  // biome-ignore lint/suspicious/noThenProperty: PagePromise is deliberately thenable.
  then<R1 = Page<T>, R2 = never>(
    onfulfilled?: ((value: Page<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.#page().then(onfulfilled, onrejected);
  }

  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<Page<T> | R> {
    return this.#page().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<Page<T>> {
    return this.#page().finally(onfinally);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    yield* await this.#page();
  }

  /** Collects every item across all pages into an array. Mind the size of what you list. */
  async toArray(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) items.push(item);
    return items;
  }
}
