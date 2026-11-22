import { createHmac } from "node:crypto";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  constructEvent,
  constructPreCallRequest,
  parseSignatureHeader,
  secureCompare,
  signPayload,
  verifySignature,
  type WebhookEvent,
  WebhookVerificationError,
} from "../src/webhooks/index.js";
import { booking } from "./fixtures.js";

const secret = "whsec_demo_secret";
const now = 1763478245;
const event = {
  id: "5b0e3a4c-9d2f-4c1e-a7b4-2f6d8e1c0a93",
  type: "booking.created",
  created_at: "2026-11-18T15:04:05.000Z",
  workspace_id: "0f8f6d0e-2b1a-4c3d-9e8f-7a6b5c4d3e2f",
  tenant_id: "0f8f6d0e-2b1a-4c3d-9e8f-7a6b5c4d3e2f",
  api_version: "2026-11-16",
  data: { booking },
};
const body = JSON.stringify(event);

/** The algorithm from the docs, with node:crypto, to check signPayload against. */
function referenceSignature(payload: string, key: string, t: number): string {
  return createHmac("sha256", key).update(`${t}.${payload}`).digest("hex");
}

describe("signatures", () => {
  it("matches the documented HMAC-SHA256 of `<t>.<raw body>`", async () => {
    const header = await signPayload(body, secret, now);
    expect(header).toBe(`t=${now},v1=${referenceSignature(body, secret, now)}`);
  });

  it("verifies strings, Buffers, Uint8Arrays and ArrayBuffers", async () => {
    const header = await signPayload(body, secret, now);
    const bytes = new TextEncoder().encode(body);
    for (const payload of [body, Buffer.from(body), bytes, bytes.buffer]) {
      expect(await verifySignature(payload, header, secret, { now })).toBe(true);
    }
  });

  it("accepts either v1 while a secret rotates", async () => {
    const header = `t=${now},v1=${referenceSignature(body, "whsec_old", now)},v1=${referenceSignature(body, secret, now)}`;
    expect(await verifySignature(body, header, secret, { now })).toBe(true);
    expect(await verifySignature(body, header, "whsec_old", { now })).toBe(true);
    expect(await verifySignature(body, header, "whsec_other", { now })).toBe(false);
  });

  it("accepts a list of secrets", async () => {
    const header = await signPayload(body, secret, now);
    expect(await verifySignature(body, header, ["whsec_client_a", secret], { now })).toBe(true);
  });

  it("rejects a changed body", async () => {
    const header = await signPayload(body, secret, now);
    expect(await verifySignature(`${body} `, header, secret, { now })).toBe(false);
  });

  it("rejects timestamps outside the tolerance", async () => {
    const header = await signPayload(body, secret, now);
    expect(await verifySignature(body, header, secret, { now: now + 301 })).toBe(false);
    expect(await verifySignature(body, header, secret, { now: now - 301 })).toBe(false);
    expect(await verifySignature(body, header, secret, { now: now + 300 })).toBe(true);
    expect(await verifySignature(body, header, secret, { now: now + 3600, tolerance: 7200 })).toBe(true);
  });

  it.each([
    [undefined, "missing_header"],
    ["", "missing_header"],
    ["v1=abc", "malformed_header"],
    [`t=${now}`, "malformed_header"],
    [`t=soon,v1=${"a".repeat(64)}`, "malformed_header"],
    [`t=${now},v1=not-hex`, "no_matching_signature"],
  ])("explains why %j fails: %s", async (header, reason) => {
    const error = await constructEvent(body, header, secret, { now }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WebhookVerificationError);
    expect((error as WebhookVerificationError).reason).toBe(reason);
  });

  it("refuses parsed JSON instead of the raw body", async () => {
    const header = await signPayload(body, secret, now);
    await expect(constructEvent(event as unknown as string, header, secret, { now })).rejects.toMatchObject({
      reason: "invalid_payload",
    });
  });

  it("parses headers with spaces and unknown parts", () => {
    expect(parseSignatureHeader(` t=${now} , v0=old, v1=abc ,v1=def`)).toEqual({
      timestamp: now,
      signatures: ["abc", "def"],
    });
  });
});

describe("constructEvent", () => {
  it("returns a typed event", async () => {
    const header = await signPayload(body, secret, now);
    const parsed = await constructEvent(body, header, secret, { now });
    expectTypeOf(parsed).toEqualTypeOf<WebhookEvent>();
    expect(parsed.type).toBe("booking.created");
    if (parsed.type === "booking.created") {
      expectTypeOf(parsed.data.booking.start).toBeString();
      expect(parsed.data.booking.id).toBe(booking.id);
    }
  });

  it("rejects a signed body that isn't JSON", async () => {
    const header = await signPayload("not json", secret, now);
    await expect(constructEvent("not json", header, secret, { now })).rejects.toMatchObject({
      reason: "invalid_payload",
    });
  });
});

describe("constructPreCallRequest", () => {
  it("verifies and parses a pre-call request", async () => {
    const ring = JSON.stringify({
      call_id: "8c2f6a1e-4b3d-4e5f-9a8b-7c6d5e4f3a2b",
      agent_id: "3e1d2c4b-5a6f-4b7c-8d9e-0f1a2b3c4d5e",
      kind: "live",
      from: "+15555550199",
      to: "+15555550100",
      person: null,
    });
    const header = await signPayload(ring, "whsec_precall", now);
    const req = await constructPreCallRequest(ring, header, "whsec_precall", { now });
    expect(req.from).toBe("+15555550199");
  });
});

describe("secureCompare", () => {
  it("compares strings", async () => {
    expect(await secureCompare("Bearer tool_secret", "Bearer tool_secret")).toBe(true);
    expect(await secureCompare("Bearer tool_secret", "Bearer tool_secreT")).toBe(false);
    expect(await secureCompare("Bearer tool_secret", "Bearer")).toBe(false);
    expect(await secureCompare("", "")).toBe(true);
  });
});
