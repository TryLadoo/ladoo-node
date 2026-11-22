// Demo data typed against the generated OpenAPI types, so a fixture that drifts
// from the API's shapes fails `npm run typecheck`. 555 numbers only.
import type { CalendarBooking, CallDetail, CallListItem, Person, WebhookEndpointWithSecret } from "../src/index.js";

export const callListItem: CallListItem = {
  id: "c2a1e9b8-4f3d-4a2c-9b1e-8d7c6b5a4f3e",
  kind: "live",
  channel: "phone",
  widget_id: null,
  language: "en",
  direction: "inbound",
  status: "completed",
  phone_number_id: "d5e6f7a8-b9c0-4d1e-8f2a-3b4c5d6e7f80",
  deployment_id: null,
  workflow_version_id: null,
  config_hash: "demo",
  time_zone: "America/Chicago",
  from_number: "+15555550100",
  to_number: "+15555550001",
  started_at: "2026-11-18T15:00:00.000Z",
  ended_at: "2026-11-18T15:02:22.000Z",
  duration_seconds: 142,
  end_reason: "caller_hangup",
  summary: "Caller reported a leaking water heater; message taken.",
  outcome: { type: "message_taken", crm_ref: null, details: {}, reached: ["message_taken", "urgent_escalated"] },
  extracted: { caller_name: "Jordan Rivera", reason: "Leaking water heater" },
  urgency: "high",
  recording_url: null,
  hung_up_early: false,
  billable: true,
  created_at: "2026-11-18T15:00:00.000Z",
  person: { id: "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b", name: "Jordan Rivera" },
  success: null,
};

export function call(id: string, startedAt = "2026-11-18T15:00:00.000Z"): CallListItem {
  return { ...callListItem, id, started_at: startedAt };
}

export const callDetail: CallDetail = {
  ...callListItem,
  binding_id: null,
  provider_call_id: null,
  transcript: [
    { role: "agent", text: "Thanks for calling.", start_ms: 0, end_ms: 1800 },
    { role: "caller", text: "My water heater is leaking.", start_ms: 2000, end_ms: 4200 },
  ],
  flags: null,
  guardrail_breaches: null,
  tool_calls: null,
  latency: null,
  node_trail: null,
  completed_at: "2026-11-18T15:02:22.000Z",
  steps: [],
  judgment: null,
  crm_sync: null,
  follow_up: null,
  text_back: null,
  booking_notices: [],
};

export const booking: CalendarBooking = {
  id: "a7d3c1e2-6b5f-4e8d-9c0a-1b2c3d4e5f60",
  start: "2026-11-23T16:00:00.000Z",
  end: "2026-11-23T17:00:00.000Z",
  title: "Jordan Rivera: Leak",
  caller_name: "Jordan Rivera",
  person_name: "Jordan Rivera",
  caller_phone: "+15555550100",
  call_id: "c2a1e9b8-4f3d-4a2c-9b1e-8d7c6b5a4f3e",
  agent_name: "Front desk",
  calendars: ["Google Calendar"],
  reason: "Leak",
  status: "booked",
  cancellable: true,
  events: [{ label: "Google Calendar", provider: "google", state: "booked", error: null }],
  cancelled_at: null,
  cancelled_by: null,
  summary: null,
  notices: [],
};

export const person: Person = {
  id: "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a5b",
  name: "Jordan Rivera",
  phone: "+15555550100",
  email: null,
  first_contact_at: "2026-11-18T15:00:00.000Z",
  last_contact_at: "2026-11-18T15:00:00.000Z",
  channels: ["phone"],
  conversations: 1,
  possible_match: false,
  possible_matches: 0,
};

export const webhookEndpoint: WebhookEndpointWithSecret = {
  id: "f0e1d2c3-b4a5-4968-8776-655443322110",
  url: "https://hooks.example.com/ladoo",
  description: "Calls into our CRM",
  events: ["call.completed"],
  enabled: true,
  failing_since: null,
  auto_disabled_at: null,
  previous_secret_expires_at: null,
  created_at: "2026-11-18T15:00:00.000Z",
  updated_at: "2026-11-18T15:00:00.000Z",
  secret: "whsec_demo_not_a_real_secret",
};
