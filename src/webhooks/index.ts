import type { PreCallRequest, WebhookEvent } from "./events.js";
import {
  assertValidSignature,
  type Payload,
  toBytes,
  type VerifyOptions,
  WebhookVerificationError,
} from "./signature.js";

export type * from "./events.js";
export {
  assertValidSignature,
  DEFAULT_TOLERANCE,
  type ParsedSignatureHeader,
  type Payload,
  parseSignatureHeader,
  secureCompare,
  signPayload,
  type VerifyOptions,
  verifySignature,
  WebhookVerificationError,
  type WebhookVerificationReason,
} from "./signature.js";

/**
 * Verifies a webhook event's `Ladoo-Signature` and returns the parsed event.
 * Throws {@link WebhookVerificationError} if the signature or body is bad.
 *
 * ```ts
 * const event = await constructEvent(rawBody, req.headers["ladoo-signature"], process.env.LADOO_WEBHOOK_SECRET);
 * ```
 */
export async function constructEvent(
  payload: Payload,
  header: string | null | undefined,
  secret: string | readonly string[],
  options?: VerifyOptions,
): Promise<WebhookEvent> {
  return verifyAndParse<WebhookEvent>(payload, header, secret, options);
}

/**
 * Verifies a pre-call webhook request with the agent's pre-call signing secret
 * and returns its body. Pre-call requests are signed exactly like events.
 */
export async function constructPreCallRequest(
  payload: Payload,
  header: string | null | undefined,
  secret: string | readonly string[],
  options?: VerifyOptions,
): Promise<PreCallRequest> {
  return verifyAndParse<PreCallRequest>(payload, header, secret, options);
}

async function verifyAndParse<T>(
  payload: Payload,
  header: string | null | undefined,
  secret: string | readonly string[],
  options: VerifyOptions | undefined,
): Promise<T> {
  await assertValidSignature(payload, header, secret, options);
  try {
    return JSON.parse(new TextDecoder().decode(toBytes(payload))) as T;
  } catch {
    throw new WebhookVerificationError("invalid_payload", "The body is signed but isn't valid JSON.");
  }
}
