# Contributing

Bug reports and pull requests are welcome. For anything larger than a fix, open an issue first so we can agree on the approach.

## Setup

```sh
git clone https://github.com/TryLadoo/ladoo-node.git
cd ladoo-node
npm install
npm test
```

Before you push, run what CI runs:

```sh
npm run lint && npm run generate:check && npm run typecheck && npm test
```

Tests run offline against a mocked `fetch`. `npm run test:live` also runs a few read-only requests against the real API when `LADOO_API_KEY` is set.

## Generated code

`src/generated/` is generated from `openapi/openapi.json`. Don't edit it by hand.

- `npm run generate` downloads the live document and regenerates.
- `npm run generate:offline` regenerates from the committed snapshot.
- New endpoints need a method name in `scripts/operations.mjs`. The generator fails until every endpoint that accepts an API key has one.

## Pull requests

- Keep each pull request to one change, with a test.
- Add a line to `CHANGELOG.md` under "Unreleased".
- Use plain commit messages that say what changed, like "Add retries for 409 idempotency_key_in_use".
