// Every operation in scripts/operations.mjs must be callable on the client and
// hit the method and path the OpenAPI document gives it.
import { describe, expect, it } from "vitest";
import { operations } from "../scripts/operations.mjs";
import { json, mockClient } from "./helpers.js";

describe("operation coverage", () => {
  const entries = Object.entries(operations as Record<string, string>);

  it.each(entries)("%s -> ladoo.%s", async (key, target) => {
    const [method, path] = key.split(" ") as [string, string];
    const { ladoo, requests } = mockClient(() => json({ data: [], next_cursor: null }));

    const segments = target.split(".");
    const name = segments.pop() as string;
    let owner: Record<string, unknown> = ladoo as unknown as Record<string, unknown>;
    for (const seg of segments) owner = owner[seg] as Record<string, unknown>;
    const fn = owner[name] as (...args: unknown[]) => PromiseLike<unknown>;
    expect(typeof fn).toBe("function");

    const pathParams = path.match(/\{[^}]+\}/g) ?? [];
    const args = pathParams.map((_, i) => `p${i}`);
    await fn.apply(owner, [...args, {}]);

    let expected = path;
    pathParams.forEach((p, i) => {
      expected = expected.replace(p, `p${i}`);
    });
    expect(requests[0]?.method).toBe(method);
    expect(requests[0]?.url.pathname).toBe(expected);
  });
});
