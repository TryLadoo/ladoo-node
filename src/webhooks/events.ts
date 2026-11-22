import type {
  CalendarBooking,
  CallDetail,
  CallJudgment,
  KnowledgeSource,
  Person,
  PhoneNumber,
} from "../generated/types.js";

interface EventEnvelope<Type extends string, Data> {
  /** The same on every redelivery of this event. Use it to skip events you've handled. */
  id: string;
  type: Type;
  created_at: string;
  /** The workspace it happened in. */
  workspace_id: string;
  /** Same value as `workspace_id`, kept for endpoints made before that field existed. */
  tenant_id: string;
  /** The API version the payload follows. */
  api_version: string;
  data: Data;
}

export type CallEventType =
  | "call.started"
  | "call.completed"
  | "call.flagged_urgent"
  | "call.transferred"
  | "message.taken";

/** `call.started` carries the call so far, with `status: "in_progress"`. */
export type CallEvent = EventEnvelope<CallEventType, { call: CallDetail }>;

export type CallAnalyzedEvent = EventEnvelope<
  "call.analyzed",
  {
    call: CallDetail;
    /** `null` for calls that aren't reviewed: chats, spam, blocked callers, calls with no conversation. */
    judgment: CallJudgment;
  }
>;

export type BookingCreatedEvent = EventEnvelope<"booking.created", { booking: CalendarBooking }>;

/** A move books the new time, then cancels the old one; no `booking.cancelled` follows. */
export type BookingRescheduledEvent = EventEnvelope<
  "booking.rescheduled",
  {
    /** The new appointment. */
    booking: CalendarBooking;
    /** The appointment it replaced. */
    previous_booking_id: string;
  }
>;

/** Also sent with `status: "cancel_failed"` when a calendar couldn't remove it. */
export type BookingCancelledEvent = EventEnvelope<"booking.cancelled", { booking: CalendarBooking }>;

export type PersonEvent = EventEnvelope<"person.created" | "person.updated", { person: Person }>;

export type KnowledgeSourceFailedEvent = EventEnvelope<"knowledge.source_failed", { source: KnowledgeSource }>;

/** `number.released` carries the number with `status: "released"`. */
export type PhoneNumberEvent = EventEnvelope<"number.purchased" | "number.released", { phone_number: PhoneNumber }>;

/**
 * Every webhook event, discriminated on `type`.
 *
 * Ladoo adds event types without a new API version, so keep a `default` branch
 * when you switch on `type`.
 */
export type WebhookEvent =
  | CallEvent
  | CallAnalyzedEvent
  | BookingCreatedEvent
  | BookingRescheduledEvent
  | BookingCancelledEvent
  | PersonEvent
  | KnowledgeSourceFailedEvent
  | PhoneNumberEvent;

export type WebhookEventType = WebhookEvent["type"];

/** Narrows the union to one event type: `EventOf<"booking.created">`. */
export type EventOf<T extends WebhookEventType> = Extract<WebhookEvent, { type: T }>;

/** The body Ladoo POSTs to an agent's pre-call webhook when a call rings. */
export interface PreCallRequest {
  /** The id the call will have: `GET /v1/calls/{call_id}` and `call.*` events use it. */
  call_id: string;
  agent_id: string;
  /** `test` for a test call from the dashboard. */
  kind: "live" | "test";
  /** The caller in E.164, or `null` when caller ID is withheld. */
  from: string | null;
  /** The Ladoo number they called, or `null` on a test. */
  to: string | null;
  /** The caller when they're already in People. */
  person: { id: string; name: string | null; email: string | null } | null;
}

/** What a pre-call webhook answers, within 1 second. Every field is optional; `{}` changes nothing. */
export interface PreCallResponse {
  /** Up to 30 values for the workflow, as `{{name}}`. Text up to 500 characters. */
  variables?: Record<string, string | number | boolean>;
  caller?: { name?: string; first_name?: string };
  /** Up to 1,000 characters the agent reads as information about the caller. */
  note_for_agent?: string;
  /** `block` and `transfer:` apply to phone calls only. */
  route?: "default" | "block" | `transfer:+${string}`;
}
