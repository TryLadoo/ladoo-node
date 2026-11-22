// Writes last week's calls to a CSV file.
//
//   LADOO_API_KEY=lsk_… npx tsx examples/export-calls-csv.ts > calls.csv
import { Ladoo } from "ladoo";

const ladoo = new Ladoo();

const to = new Date();
const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);

const columns = ["started_at", "from_number", "duration_seconds", "outcome", "urgency", "caller_name", "summary"];
console.log(columns.join(","));

let count = 0;
// limit: 200 is the largest page, so the fewest requests.
for await (const call of ladoo.calls.list({
  from: from.toISOString(),
  to: to.toISOString(),
  kind: "live",
  limit: 200,
})) {
  const row = [
    call.started_at,
    call.from_number,
    call.duration_seconds,
    call.outcome?.type,
    call.urgency,
    call.extracted?.caller_name,
    call.summary,
  ];
  console.log(row.map(csvField).join(","));
  count++;
}
console.error(`Exported ${count} calls from ${from.toISOString()} to ${to.toISOString()}.`);

function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
