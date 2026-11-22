/** The `error` object every failed Ladoo API response carries. */
export interface APIErrorBody {
  /** Stable. Write code against it. */
  code: string;
  /** For people. It can change at any time, so never match on it. */
  message: string;
  /** More about what went wrong, for some errors. */
  details?: unknown;
  /** Include it when you write to support. */
  request_id: string;
}

/** Base class of every error the SDK throws. */
export class LadooError extends Error {
  override name = "LadooError";
}

/**
 * The API answered with an error status.
 *
 * Match on `code` (like `insufficient_scope`) or on the subclass, never on `message`.
 * New codes can appear at any time; treat one you don't know by its `status`.
 */
export class APIError extends LadooError {
  override name = "APIError";
  /** The HTTP status. */
  readonly status: number;
  /** The stable error code, like `not_found` or `rate_limited`. */
  readonly code: string;
  /** The request id. Include it when you contact support. */
  readonly requestId: string | undefined;
  /** Extra detail some errors carry, like `required` for `insufficient_scope`. */
  readonly details: unknown;
  /** The response headers. */
  readonly headers: Headers;

  constructor(status: number, body: Partial<APIErrorBody> | undefined, headers: Headers, fallbackMessage?: string) {
    const code = body?.code ?? `http_${status}`;
    const message = body?.message ?? fallbackMessage ?? `Ladoo answered ${status}`;
    super(`${status} ${code}: ${message}`);
    this.status = status;
    this.code = code;
    this.requestId = body?.request_id;
    this.details = body?.details;
    this.headers = headers;
  }

  /** @internal */
  static from(
    status: number,
    body: Partial<APIErrorBody> | undefined,
    headers: Headers,
    fallbackMessage?: string,
  ): APIError {
    const Ctor = errorClassFor(status);
    return new Ctor(status, body, headers, fallbackMessage);
  }
}

/** 400: the request isn't valid. `details.issues` lists each problem for `validation_failed`. */
export class BadRequestError extends APIError {
  override name = "BadRequestError";
}

/** 401: no key, or one that's wrong, revoked or expired (`unauthorized`, `key_expired`). */
export class AuthenticationError extends APIError {
  override name = "AuthenticationError";
}

/** 402: the plan doesn't include this, or its limit is reached. */
export class PaymentRequiredError extends APIError {
  override name = "PaymentRequiredError";
}

/** 403: the key can't do this here (`insufficient_scope`, `ip_not_allowed`, ...). */
export class PermissionDeniedError extends APIError {
  override name = "PermissionDeniedError";
}

/** 404: no such thing in this workspace. */
export class NotFoundError extends APIError {
  override name = "NotFoundError";
}

/** 409: it clashes with how things are now, like a duplicate. */
export class ConflictError extends APIError {
  override name = "ConflictError";
}

/** 413: the body is too large. */
export class PayloadTooLargeError extends APIError {
  override name = "PayloadTooLargeError";
}

/** 422: valid JSON that can't be done, like a reused `Idempotency-Key`. */
export class UnprocessableEntityError extends APIError {
  override name = "UnprocessableEntityError";
}

/** 429: over a rate limit. Thrown once retries are used up. */
export class RateLimitError extends APIError {
  override name = "RateLimitError";

  /** Seconds the API asked you to wait (`Retry-After`), when it said. */
  get retryAfter(): number | undefined {
    const value = this.headers.get("retry-after");
    if (value === null) return undefined;
    const seconds = Number(value);
    return Number.isFinite(seconds) ? seconds : undefined;
  }
}

/** 5xx: something went wrong on Ladoo's side. Thrown once retries are used up. */
export class InternalServerError extends APIError {
  override name = "InternalServerError";
}

/** No response at all: DNS, TLS, a dropped connection. Thrown once retries are used up. */
export class APIConnectionError extends LadooError {
  override name = "APIConnectionError";

  constructor(message = "Couldn't reach the Ladoo API.", options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** An attempt took longer than the `timeout`. Thrown once retries are used up. */
export class APITimeoutError extends APIConnectionError {
  override name = "APITimeoutError";

  constructor(timeout: number) {
    super(`The request timed out after ${timeout} ms.`);
  }
}

/** The request was aborted through your `signal`. */
export class APIUserAbortError extends LadooError {
  override name = "APIUserAbortError";

  constructor() {
    super("The request was aborted.");
  }
}

function errorClassFor(status: number): typeof APIError {
  switch (status) {
    case 400:
      return BadRequestError;
    case 401:
      return AuthenticationError;
    case 402:
      return PaymentRequiredError;
    case 403:
      return PermissionDeniedError;
    case 404:
      return NotFoundError;
    case 409:
      return ConflictError;
    case 413:
      return PayloadTooLargeError;
    case 422:
      return UnprocessableEntityError;
    case 429:
      return RateLimitError;
    default:
      return status >= 500 ? InternalServerError : APIError;
  }
}
