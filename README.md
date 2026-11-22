<p>
  <a href="https://tryladoo.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/ladoo-wordmark-on-dark.svg">
      <img src="assets/ladoo-wordmark.svg" alt="Ladoo" height="48">
    </picture>
  </a>
</p>

# Ladoo Node.js SDK

[![CI](https://github.com/TryLadoo/ladoo-node/actions/workflows/ci.yml/badge.svg)](https://github.com/TryLadoo/ladoo-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The official TypeScript and JavaScript client for the [Ladoo API](https://tryladoo.com/docs/developers). Read calls and transcripts, manage people, agents, bookings and webhooks, and verify the requests Ladoo sends your servers.

It has no runtime dependencies and runs on Node.js 18+, Bun, Deno, Cloudflare Workers and Vercel Edge. Types are generated from the [OpenAPI document](https://api.tryladoo.com/openapi.json).

## Install

```sh
npm install github:TryLadoo/ladoo-node
```

Not on npm yet. Registry releases are on the [roadmap](#roadmap).

npm builds the package on install with its `prepare` script. If your npm asks you to approve install scripts, approve `ladoo`.

## Quickstart

Create an API key under **Settings → Developers** in Ladoo and set it as `LADOO_API_KEY`.

```ts
import { Ladoo } from "ladoo";

const ladoo = new Ladoo(); // reads LADOO_API_KEY

const page = await ladoo.calls.list({ limit: 5 });
for (const call of page.data) {
  console.log(call.started_at, call.from_number, call.summary);
}
```

Every method maps to one endpoint, and its namespace follows the API: `ladoo.calls`, `ladoo.people`, `ladoo.agents.tools`, `ladoo.knowledgeBases.sources`, `ladoo.calendar.bookings`, `ladoo.webhookEndpoints` and so on. Request and response types come from the API's own schemas, so your editor knows every field.

## Recipes

### Go through every call in a range

List methods page automatically when you iterate them:

```ts
for await (const call of ladoo.calls.list({ from: "2026-11-01T00:00:00Z", outcome: "booked", limit: 200 })) {
  console.log(call.id, call.extracted?.caller_name);
}
```

Or work a page at a time:

```ts
let page = await ladoo.people.list({ limit: 100 });
while (page.hasNextPage()) {
  page = await page.getNextPage();
}
```

### Find a caller by phone number

```ts
const { data } = await ladoo.people.list({ q: "+15555550100" });
const person = data[0] ?? (await ladoo.people.create({ name: "Jordan Rivera", phone: "+15555550100" }));
```

### Cancel an appointment

```ts
const { bookings } = await ladoo.calendar.bookings.list({
  from: "2026-11-23T00:00:00Z",
  to: "2026-11-30T00:00:00Z",
});
const booking = bookings.find((b) => b.caller_phone === "+15555550100" && b.cancellable);
if (booking) await ladoo.calendar.bookings.cancel(booking.id);
```

### Teach an agent an answer

```ts
const kb = await ladoo.knowledgeBases.create({ name: "Front desk FAQ" });
await ladoo.knowledgeBases.addAnswer(kb.id, {
  question: "Do you work weekends?",
  answer: "Yes, Saturdays from 9 to 1 for emergencies.",
});
await ladoo.agents.knowledgeBases.set(agentId, { knowledge_base_ids: [kb.id] });
```

### Handle errors

```ts
import { NotFoundError, PermissionDeniedError } from "ladoo";

try {
  await ladoo.calls.retrieve(callId);
} catch (error) {
  if (error instanceof NotFoundError) return null;
  if (error instanceof PermissionDeniedError) console.error(error.code, error.details); // insufficient_scope, { required: "calls:read" }
  throw error;
}
```

Every API error is an `APIError` with `status`, `code` and `requestId` (include it when you contact support). The subclasses are `BadRequestError`, `AuthenticationError`, `PaymentRequiredError`, `PermissionDeniedError`, `NotFoundError`, `ConflictError`, `PayloadTooLargeError`, `UnprocessableEntityError`, `RateLimitError` and `InternalServerError`. Network failures throw `APIConnectionError` and timeouts `APITimeoutError`.

## Webhooks

`ladoo/webhooks` checks the `Ladoo-Signature` header and parses the event into a typed union. Pass the raw body, before any JSON parsing:

```ts
import express from "express";
import { constructEvent } from "ladoo/webhooks";

const app = express();

app.post("/ladoo", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = await constructEvent(req.body, req.header("ladoo-signature"), process.env.LADOO_WEBHOOK_SECRET!);
  } catch {
    return res.sendStatus(400);
  }

  switch (event.type) {
    case "booking.created":
      console.log("Booked:", event.data.booking.title, event.data.booking.start);
      break;
    case "call.flagged_urgent":
      console.log("Urgent:", event.data.call.summary);
      break;
  }
  res.sendStatus(204);
});
```

- It accepts any of several `v1` signatures, so deliveries keep verifying for the 24 hours after you rotate a secret. Pass an array to accept several secrets.
- Timestamps more than 5 minutes from now are refused; change that with `{ tolerance: seconds }`.
- Comparison is constant time, and it uses WebCrypto, so the same code runs on Node.js, Bun, Deno, Cloudflare Workers and Vercel Edge.
- `verifySignature` returns a boolean instead of throwing. `signPayload` builds a valid header for your tests.
- Ladoo adds event types without a new API version, so keep a `default` branch.

**Pre-call webhooks** are signed the same way, with the agent's pre-call secret. `constructPreCallRequest` returns the typed request, and `PreCallResponse` types your answer:

```ts
import { constructPreCallRequest, type PreCallResponse } from "ladoo/webhooks";

const ring = await constructPreCallRequest(rawBody, signature, process.env.LADOO_PRECALL_SECRET!);
const reply: PreCallResponse = { caller: { name: "Sam Demo" }, variables: { plan: "gold" } };
```

**Custom tools** don't carry a `Ladoo-Signature`. Give the tool an `Authorization` header with a secret and check it with `secureCompare(received, expected)`.

[`examples/`](examples) has a Slack notifier, a pre-call lookup, a Cloudflare Worker serving a custom tool and a CSV export.

## Configuration

```ts
const ladoo = new Ladoo({
  apiKey: "lsk_…", // default: process.env.LADOO_API_KEY
  apiVersion: "2026-11-16", // default: the version these types were generated from
  maxRetries: 2, // default: 2
  timeout: 30_000, // per attempt, in ms; default: 60_000
  baseUrl: "https://api.tryladoo.com",
  fetch: customFetch, // default: globalThis.fetch
});
```

- **Retries.** 429s, 5xx responses and network errors are retried with exponential backoff and jitter. A `Retry-After` header is honored.
- **Idempotency.** Every `POST` gets an `Idempotency-Key`, reused across its retries, so a retry never creates something twice. Pass `{ idempotencyKey }` to choose your own.
- **Versions.** The client sends `Ladoo-Version` so responses match its types. Override it per client or per request.
- **Per request.** Every method takes a last `options` argument: `headers`, `signal`, `timeout`, `maxRetries`, `idempotencyKey` and `apiVersion`.

For an endpoint this version doesn't cover yet, `ladoo.request({ method, path, query, body })` sends a raw request with the same retries and errors.

## Documentation

- [Developer docs](https://tryladoo.com/docs/developers)
- [API reference](https://tryladoo.com/docs/developers/api-reference)
- [Webhook events](https://tryladoo.com/docs/developers/webhook-events)
- [Errors and rate limits](https://tryladoo.com/docs/developers/errors-and-rate-limits)

## Roadmap

- Publish to npm, with provenance.
- Typed `ladoo.agents.workflow` graphs instead of plain objects.
- Helpers for reading `RateLimit-*` headers on successful responses.
- Framework adapters for webhook routes (Next.js, Hono, Express).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Ladoo LLC
