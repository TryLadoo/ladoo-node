import { describe, expect, it } from "vitest";
import { call } from "./fixtures.js";
import { json, mockClient } from "./helpers.js";

const pages: Record<string, { data: ReturnType<typeof call>[]; next_cursor: string | null }> = {
  first: { data: [call("1"), call("2")], next_cursor: "cursor-2" },
  "cursor-2": { data: [call("3"), call("4")], next_cursor: "cursor-3" },
  "cursor-3": { data: [call("5")], next_cursor: null },
};

function paged() {
  return mockClient((req) => json(pages[req.url.searchParams.get("cursor") ?? "first"]));
}

describe("pagination", () => {
  it("iterates every item across pages with for await", async () => {
    const { ladoo, requests } = paged();
    const ids: string[] = [];
    for await (const c of ladoo.calls.list({ limit: 2, outcome: "booked" })) ids.push(c.id);
    expect(ids).toEqual(["1", "2", "3", "4", "5"]);
    expect(requests.map((r) => r.url.searchParams.get("cursor"))).toEqual([null, "cursor-2", "cursor-3"]);
    expect(requests.every((r) => r.url.searchParams.get("outcome") === "booked")).toBe(true);
  });

  it("returns a page when awaited", async () => {
    const { ladoo, requests } = paged();
    const page = await ladoo.calls.list({ limit: 2 });
    expect(page.data.map((c) => c.id)).toEqual(["1", "2"]);
    expect(page.nextCursor).toBe("cursor-2");
    expect(page.hasNextPage()).toBe(true);

    const next = await page.getNextPage();
    expect(next.data.map((c) => c.id)).toEqual(["3", "4"]);
    expect(requests).toHaveLength(2);
  });

  it("walks pages", async () => {
    const { ladoo } = paged();
    const sizes: number[] = [];
    for await (const page of (await ladoo.calls.list()).pages()) sizes.push(page.data.length);
    expect(sizes).toEqual([2, 2, 1]);
  });

  it("stops early without fetching more pages", async () => {
    const { ladoo, requests } = paged();
    for await (const c of ladoo.calls.list()) {
      if (c.id === "2") break;
    }
    expect(requests).toHaveLength(1);
  });

  it("collects everything with toArray", async () => {
    const { ladoo } = paged();
    expect(await ladoo.calls.list().toArray()).toHaveLength(5);
  });

  it("doesn't send a request until awaited or iterated", async () => {
    const { ladoo, requests } = paged();
    const list = ladoo.calls.list();
    expect(requests).toHaveLength(0);
    await list;
    await list;
    expect(requests).toHaveLength(1);
  });

  it("rejects getNextPage on the last page", async () => {
    const { ladoo } = mockClient(() => json({ data: [], next_cursor: null }));
    const page = await ladoo.people.list();
    expect(page.hasNextPage()).toBe(false);
    await expect(page.getNextPage()).rejects.toThrow(/last page/);
  });

  it("keeps extra list fields on page.body", async () => {
    const { ladoo } = mockClient(() => json({ data: [], has_more: false, next_cursor: null }));
    const page = await ladoo.voices.list({ search: "warm" });
    expect(page.body.has_more).toBe(false);
  });
});
