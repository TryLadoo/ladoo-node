// Posts new bookings and urgent calls to a Slack channel.
//
//   LADOO_WEBHOOK_SECRET=whsec_… SLACK_WEBHOOK_URL=https://hooks.slack.com/services/… \
//     npx tsx examples/slack-notifier.ts
//
// Then create a webhook endpoint for booking.created and call.flagged_urgent
// pointing at https://<your host>/ladoo.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { constructEvent, type WebhookEvent, WebhookVerificationError } from "ladoo/webhooks";

const secret = env("LADOO_WEBHOOK_SECRET");
const slackUrl = env("SLACK_WEBHOOK_URL");

// Ladoo can send an event more than once. Use a database in production.
const handled = new Set<string>();

const app = new Hono();

app.post("/ladoo", async (c) => {
  const body = new Uint8Array(await c.req.arrayBuffer());
  let event: WebhookEvent;
  try {
    event = await constructEvent(body, c.req.header("ladoo-signature"), secret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) return c.text(error.message, 400);
    throw error;
  }

  if (!handled.has(event.id)) {
    handled.add(event.id);
    const text = slackMessage(event);
    // Answer Ladoo first: a slow Slack call would count as a failed delivery.
    if (text) void postToSlack(text).catch((error) => console.error("Slack:", error));
  }
  return c.body(null, 204);
});

function slackMessage(event: WebhookEvent): string | null {
  switch (event.type) {
    case "booking.created": {
      const { booking } = event.data;
      const when = new Date(booking.start).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
      return `:calendar: New booking: *${booking.title}* on ${when}`;
    }
    case "call.flagged_urgent": {
      const { call } = event.data;
      const who = call.extracted?.caller_name ?? call.from_number ?? "Unknown caller";
      return `:rotating_light: Urgent call from *${who}*: ${call.summary ?? "no summary yet"}`;
    }
    default:
      return null;
  }
}

async function postToSlack(text: string): Promise<void> {
  const res = await fetch(slackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack answered ${res.status}`);
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name}`);
  return value;
}

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, ({ port }) => {
  console.log(`Listening on http://localhost:${port}/ladoo`);
});
