# Examples

Each example is one file you can copy into your own project. To run them from this repo:

```sh
npm install
npx tsx examples/<file>.ts
```

| Example                                       | What it does                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`slack-notifier.ts`](slack-notifier.ts)      | Webhook receiver (Hono) that posts new bookings and urgent calls to Slack.                             |
| [`pre-call-lookup.ts`](pre-call-lookup.ts)    | Pre-call webhook that looks the caller up, sets workflow variables and blocks known spam.              |
| [`order-status-worker/`](order-status-worker) | Cloudflare Worker serving an `order_status` custom tool, plus a script that adds the tool to an agent. |
| [`export-calls-csv.ts`](export-calls-csv.ts)  | Writes last week's calls to CSV, paging through the list automatically.                                |

The servers need a public https address for Ladoo to reach them. While you build, a tunnel such as `cloudflared tunnel --url http://localhost:3000` works.

## Order status Worker

```sh
cd examples/order-status-worker
npx wrangler secret put TOOL_SECRET   # any long random string
npx wrangler deploy
TOOL_SECRET=<same value> LADOO_API_KEY=lsk_… npx tsx create-tool.ts <agent id> https://ladoo-order-status.<you>.workers.dev
```

Custom tool requests are not signed with `Ladoo-Signature`. The tool sends the `Authorization` header you set when creating it, and the Worker checks it with `secureCompare`.
