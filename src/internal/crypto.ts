// WebCrypto everywhere: the global `crypto` on Node 19+, Bun, Deno, Cloudflare
// Workers and Vercel Edge, and `node:crypto`'s `webcrypto` on Node 18.

let nodeWebCrypto: Promise<Crypto> | undefined;

// A variable specifier keeps bundlers for edge runtimes from trying to resolve it.
const NODE_CRYPTO = "node:crypto";

/** @internal */
export function getCrypto(): Promise<Crypto> {
  const global = (globalThis as { crypto?: Crypto }).crypto;
  if (global?.subtle) return Promise.resolve(global);
  nodeWebCrypto ??= import(/* webpackIgnore: true */ /* @vite-ignore */ NODE_CRYPTO).then(
    (mod: { webcrypto: Crypto }) => mod.webcrypto,
  );
  return nodeWebCrypto;
}

/** @internal A random v4 UUID. */
export async function randomUUID(): Promise<string> {
  const crypto = await getCrypto();
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
