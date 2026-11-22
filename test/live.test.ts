// Runs against the real API only when LADOO_API_KEY is set: `npm run test:live`.
// Read-only, so it's safe on any workspace. CI never sets the key.
import { describe, expect, it } from "vitest";
import { Ladoo } from "../src/index.js";

describe.skipIf(!process.env.LADOO_API_KEY)("live API", () => {
  const ladoo = () => new Ladoo();

  it("reads the workspace the key belongs to", async () => {
    const workspace = await ladoo().workspace.retrieve();
    expect(workspace.id).toBeTypeOf("string");
  });

  it("lists one page of calls", async () => {
    const page = await ladoo().calls.list({ limit: 1 });
    expect(Array.isArray(page.data)).toBe(true);
  });
});
