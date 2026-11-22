// A pre-call webhook: when a call rings, look the caller up and give the agent
// their name, plan and a note before it answers.
//
//   LADOO_PRECALL_SECRET=whsec_… npx tsx examples/pre-call-lookup.ts
//
// Point an agent at it with:
//   await ladoo.agents.updatePreCallWebhook(agentId, { url: "https://<your host>/ring" })
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { constructPreCallRequest, type PreCallResponse, WebhookVerificationError } from "ladoo/webhooks";

const secret = process.env.LADOO_PRECALL_SECRET;
if (!secret) throw new Error("Set LADOO_PRECALL_SECRET");

// Stands in for your CRM. Ladoo waits at most 1 second, so look callers up in
// an index or cache, not a slow API.
const customers = new Map([
  ["+15555550199", { name: "Sam Demo", plan: "gold", openTickets: 2, note: "Warranty runs to March." }],
  ["+15555550142", { name: "Alex Sample", plan: "basic", openTickets: 0, note: "" }],
]);
const blocked = new Set(["+15555550666"]);

const app = new Hono();

app.post("/ring", async (c) => {
  let ring: Awaited<ReturnType<typeof constructPreCallRequest>>;
  try {
    ring = await constructPreCallRequest(
      new Uint8Array(await c.req.arrayBuffer()),
      c.req.header("ladoo-signature"),
      secret,
    );
  } catch (error) {
    if (error instanceof WebhookVerificationError) return c.text(error.message, 400);
    throw error;
  }

  if (ring.from && blocked.has(ring.from)) return c.json<PreCallResponse>({ route: "block" });

  const customer = ring.from ? customers.get(ring.from) : undefined;
  if (!customer) return c.json<PreCallResponse>({});

  return c.json<PreCallResponse>({
    caller: { name: customer.name },
    variables: { plan: customer.plan, open_tickets: customer.openTickets, vip: customer.plan === "gold" },
    ...(customer.note && { note_for_agent: customer.note }),
  });
});

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, ({ port }) => {
  console.log(`Listening on http://localhost:${port}/ring`);
});
