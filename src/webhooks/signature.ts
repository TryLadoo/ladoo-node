import { getCrypto } from "../internal/crypto.js";

/** Default `tolerance`: refuse signatures more than 5 minutes from now. */
export const DEFAULT_TOLERANCE = 300;

export type Payload = string | Uint8Array | ArrayBuffer;

export interface VerifyOptions {
  /** Seconds the signature's timestamp may be from now. Defaults to 300. */
  tolerance?: number;
  /** The current time in Unix seconds. For tests. */
  now?: number;
}

export type WebhookVerificationReason =
  | "missing_header"
  | "malformed_header"
  | "timestamp_out_of_tolerance"
  | "no_matching_signature"
  | "invalid_payload";

export class WebhookVerificationError extends Error {
  override name = "WebhookVerificationError";
  readonly reason: WebhookVerificationReason;

  constructor(reason: WebhookVerificationReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

export interface ParsedSignatureHeader {
  timestamp: number;
  signatures: string[];
}

/**
 * Splits a `Ladoo-Signature` header (`t=1763478245,v1=5d41…,v1=9a2c…`).
 * While a secret rotates there are two `v1` values.
 */
export function parseSignatureHeader(header: string): ParsedSignatureHeader {
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    else if (key === "v1" && value) signatures.push(value);
  }
  if (timestamp === undefined || signatures.length === 0) {
    throw new WebhookVerificationError(
      "malformed_header",
      "The Ladoo-Signature header needs a t= timestamp and at least one v1= signature.",
    );
  }
  return { timestamp, signatures };
}

/**
 * Checks a `Ladoo-Signature` header against the raw request body and throws a
 * {@link WebhookVerificationError} if it doesn't match.
 *
 * Pass the body exactly as received, before any JSON parsing: re-encoding
 * changes the bytes and the signature with them. `secret` can be a list, for
 * a server that takes events from several endpoints.
 */
export async function assertValidSignature(
  payload: Payload,
  header: string | null | undefined,
  secret: string | readonly string[],
  options: VerifyOptions = {},
): Promise<void> {
  if (!header) {
    throw new WebhookVerificationError("missing_header", "The request has no Ladoo-Signature header.");
  }
  const body = toBytes(payload);
  const { timestamp, signatures } = parseSignatureHeader(header);
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new WebhookVerificationError(
      "timestamp_out_of_tolerance",
      `The signature's timestamp is more than ${tolerance} seconds from now. Check your server's clock, or this may be a replay.`,
    );
  }

  const crypto = await getCrypto();
  const signed = concat(new TextEncoder().encode(`${timestamp}.`), body);
  const candidates = signatures.map(hexToBytes).filter((b): b is Uint8Array<ArrayBuffer> => b !== null);
  for (const s of typeof secret === "string" ? [secret] : secret) {
    const key = await hmacKey(crypto, s);
    for (const candidate of candidates) {
      // subtle.verify compares in constant time.
      if (await crypto.subtle.verify("HMAC", key, candidate, signed)) return;
    }
  }
  throw new WebhookVerificationError(
    "no_matching_signature",
    "No signature in the Ladoo-Signature header matches this body and secret.",
  );
}

/** Like {@link assertValidSignature}, but resolves to `true` or `false` instead of throwing. */
export async function verifySignature(
  payload: Payload,
  header: string | null | undefined,
  secret: string | readonly string[],
  options?: VerifyOptions,
): Promise<boolean> {
  try {
    await assertValidSignature(payload, header, secret, options);
    return true;
  } catch (error) {
    if (error instanceof WebhookVerificationError) return false;
    throw error;
  }
}

/**
 * Builds a `Ladoo-Signature` header the way Ladoo does. Use it to send signed
 * requests to your own handler in tests.
 */
export async function signPayload(
  payload: Payload,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const crypto = await getCrypto();
  const key = await hmacKey(crypto, secret);
  const signed = concat(new TextEncoder().encode(`${timestamp}.`), toBytes(payload));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  return `t=${timestamp},v1=${Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Compares two strings in constant time, for checking a shared secret such as
 * the `Authorization` header you give a custom tool.
 */
export async function secureCompare(a: string, b: string): Promise<boolean> {
  const crypto = await getCrypto();
  // HMAC both with a throwaway key so the comparison leaks neither content nor length.
  const key = await crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(a));
  return crypto.subtle.verify("HMAC", key, mac, new TextEncoder().encode(b));
}

/** @internal */
export function toBytes(payload: Payload): Uint8Array<ArrayBuffer> {
  if (typeof payload === "string") return new TextEncoder().encode(payload);
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload);
  if (payload instanceof Uint8Array) return new Uint8Array(payload);
  throw new WebhookVerificationError(
    "invalid_payload",
    "Pass the raw request body (a string, Uint8Array, Buffer or ArrayBuffer), not parsed JSON.",
  );
}

function hmacKey(crypto: Crypto, secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
