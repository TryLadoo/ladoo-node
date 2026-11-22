// Adds the order_status tool to an agent, pointed at the deployed Worker.
//
//   LADOO_API_KEY=lsk_… TOOL_SECRET=… npx tsx examples/order-status-worker/create-tool.ts <agent id> <worker url>
import { Ladoo } from "ladoo";

const [agentId, url] = process.argv.slice(2);
if (!agentId || !url || !process.env.TOOL_SECRET) {
  throw new Error("Usage: TOOL_SECRET=… create-tool.ts <agent id> <worker url>");
}

const ladoo = new Ladoo();
const tool = await ladoo.agents.tools.create(agentId, {
  name: "order_status",
  description: "Look up an order's status and delivery date by its order number.",
  parameters: {
    type: "object",
    properties: { order_number: { type: "string", description: "The order number the caller reads out" } },
    required: ["order_number"],
  },
  method: "POST",
  url,
  headers: [{ name: "Authorization", value: `Bearer ${process.env.TOOL_SECRET}` }],
  say_while_waiting: "Let me look that up.",
  response_fields: [{ path: "status" }, { path: "eta.date" }],
});
console.log(`Created tool ${tool.id}`);
