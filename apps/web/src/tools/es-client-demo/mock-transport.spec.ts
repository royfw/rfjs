import { describe, it, expect } from "vitest";
import type { BuilderGroup } from "@rfjs/filter-builder";

import { makeMockTransport, extractTerms } from "./mock-transport";

const docs = [
  { id: "a", status: "open", body: "please refund my order" },
  { id: "b", status: "open", body: "where is my package" },
  { id: "c", status: "open", body: "refund processed" },
];

describe("makeMockTransport", () => {
  it("returns matched rows as hits + total", async () => {
    const t = makeMockTransport(docs);
    const res = await t.search({ index: "i", body: { size: 10 } });
    expect(res.hits.total.value).toBe(3);
    expect(res.hits.hits.map((h) => h._id)).toEqual(["a", "b", "c"]);
    expect(res.hits.hits[0]!._source).toEqual(docs[0]);
    expect(res.hits.hits[0]!.sort).toEqual([0]);
  });

  it("honors size and from", async () => {
    const t = makeMockTransport(docs);
    const res = await t.search({ index: "i", body: { size: 1, from: 1 } });
    expect(res.hits.hits.map((h) => h._id)).toEqual(["b"]);
  });

  it("pages with search_after (cursor = last sort)", async () => {
    const t = makeMockTransport(docs);
    const p1 = await t.search({ index: "i", body: { size: 2 } });
    expect(p1.hits.hits.map((h) => h._id)).toEqual(["a", "b"]);
    const after = p1.hits.hits[1]!.sort;
    const p2 = await t.search({ index: "i", body: { size: 2, search_after: after } });
    expect(p2.hits.hits.map((h) => h._id)).toEqual(["c"]);
  });

  it("marks query terms in highlight fields", async () => {
    const t = makeMockTransport(docs, { terms: ["refund"] });
    const res = await t.search({
      index: "i",
      body: { size: 10, highlight: { fields: { body: {} } } },
    });
    expect(res.hits.hits[0]!.highlight).toEqual({ body: ["please <em>refund</em> my order"] });
    expect(res.hits.hits[1]!.highlight).toBeUndefined();
  });

  it("openPit returns an id; closePit resolves", async () => {
    const t = makeMockTransport(docs);
    expect(await t.openPit({ index: "i", keepAlive: "1m" })).toBe("pit-mock");
    await expect(t.closePit("pit-mock")).resolves.toBeUndefined();
  });
});

describe("extractTerms", () => {
  it("collects unique string literals from conditions", () => {
    const tree: BuilderGroup = {
      kind: "group",
      id: "g",
      logic: "and",
      children: [
        { kind: "condition", id: "1", field: "status", dataType: "string", operator: "eq", value: "open" },
        { kind: "condition", id: "2", field: "body", dataType: "string", operator: "contains", value: "refund" },
        { kind: "condition", id: "3", field: "age", dataType: "numeric", operator: "gt", value: 18 },
      ],
    };
    expect(extractTerms(tree).sort()).toEqual(["open", "refund"]);
  });
});
