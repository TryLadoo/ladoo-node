# Changelog

All notable changes to this package. It follows [Semantic Versioning](https://semver.org).

## Unreleased

## 0.1.0 (2026-11-22)

First release, generated from API version `2026-11-16`.

- Client for every `/v1` endpoint that accepts an API key, with request and response types generated from the OpenAPI document.
- Cursor pagination: `for await` over any list, or page by page with `getNextPage()`.
- Retries with exponential backoff and jitter for 429s, 5xx responses and network errors, honoring `Retry-After`.
- An automatic `Idempotency-Key` on every `POST`, reused across retries.
- Typed errors carrying `status`, `code`, `requestId` and `details`.
- `ladoo/webhooks`: `constructEvent`, `constructPreCallRequest`, `verifySignature`, `signPayload` and `secureCompare`, built on WebCrypto, with types for every webhook event.
- ESM and CommonJS builds with no runtime dependencies.
