// A Cloudflare Worker that serves an "order_status" custom tool.
//
// Ladoo sends the tool's arguments as the JSON body and the headers you gave the
// tool. Custom tool requests aren't signed, so give the tool an Authorization
// header with a secret and check it here. See README.md next to this file.
import { secureCompare } from "ladoo/webhooks";

interface Env {
  TOOL_SECRET: string;
}

interface Order {
  status: "processing" | "shipped" | "delivered";
  eta: { date: string };
}

// Stands in for your order system.
const orders: Record<string, Order> = {
  "1001": { status: "shipped", eta: { date: "2026-11-25" } },
  "1002": { status: "processing", eta: { date: "2026-11-28" } },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const auth = request.headers.get("authorization") ?? "";
    if (!(await secureCompare(auth, `Bearer ${env.TOOL_SECRET}`))) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { order_number } = (await request.json()) as { order_number?: string };
    const order = order_number ? orders[order_number.replace(/\D/g, "")] : undefined;
    if (!order) return Response.json({ status: "not_found" });

    console.log(`order_status ${order_number} for call ${request.headers.get("ladoo-call-id")}`);
    return Response.json(order);
  },
};
