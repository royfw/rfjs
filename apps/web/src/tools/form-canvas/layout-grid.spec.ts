import { describe, it, expect } from "vitest";
import { collides, compact, resolveCollisions, resolveCards, moveItem, type GridItem, type PlacedCard } from "./layout-grid";

const g = (id: string, col: number, span: number, row: number): GridItem => ({ id, col, span, row });

describe("collides", () => {
  it("true when both axes overlap", () => {
    expect(collides(g("a", 1, 6, 1), g("b", 4, 6, 1))).toBe(true); // cols 1-6 vs 4-9 overlap, same row
  });
  it("false when horizontally disjoint", () => {
    expect(collides(g("a", 1, 6, 1), g("b", 7, 6, 1))).toBe(false); // 1-6 vs 7-12
  });
  it("false when on different rows", () => {
    expect(collides(g("a", 1, 6, 1), g("b", 1, 6, 2))).toBe(false);
  });
  it("never collides with itself", () => {
    const a = g("a", 1, 6, 1);
    expect(collides(a, a)).toBe(false);
  });
});

describe("compact (upward gravity)", () => {
  it("pulls a lone item with a gap up to row 1", () => {
    const out = compact([g("a", 1, 6, 5)], 12);
    expect(out.find((i) => i.id === "a")!.row).toBe(1);
  });
  it("stacks non-overlapping-column items independently at row 1", () => {
    const out = compact([g("a", 1, 6, 3), g("b", 7, 6, 9)], 12);
    expect(out.find((i) => i.id === "a")!.row).toBe(1);
    expect(out.find((i) => i.id === "b")!.row).toBe(1);
  });
  it("keeps a full-width item below a row-1 item it would collide with", () => {
    const out = compact([g("a", 1, 6, 1), g("full", 1, 12, 5)], 12);
    expect(out.find((i) => i.id === "a")!.row).toBe(1);
    expect(out.find((i) => i.id === "full")!.row).toBe(2);
  });
});

describe("resolveCollisions (move, pinned)", () => {
  it("pushes a collided item down and pins the moved item", () => {
    // 'b' originally at col1 row1; 'moved' dropped onto col1 row1 → b must move down
    const items = [g("moved", 1, 6, 1), g("b", 1, 6, 1)];
    const out = resolveCollisions(items, "moved", 12);
    expect(out.find((i) => i.id === "moved")!.row).toBe(1); // pinned
    expect(out.find((i) => i.id === "b")!.row).toBe(2); // displaced
  });
  it("produces no overlapping pair", () => {
    const items = [g("moved", 1, 8, 2), g("b", 1, 8, 2), g("c", 1, 8, 3)];
    const out = resolveCollisions(items, "moved", 12);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) expect(collides(out[i]!, out[j]!)).toBe(false);
  });
});

describe("resolveCards (per-group orchestration)", () => {
  const pc = (id: string, groupId: string, col: number, span: number, row: number): PlacedCard => ({ id, groupId, col, span, row });
  it("resolves the dragged group and compacts the source group's gap", () => {
    // g1 has a,b stacked; drag 'a' into g2 colliding with x → x moves down; g1 compacts (b rises to row 1)
    const cards = [pc("a", "g2", 1, 6, 1), pc("b", "g1", 1, 6, 2), pc("x", "g2", 1, 6, 1)];
    const out = resolveCards(cards, "a", 12);
    expect(out.find((c) => c.id === "a")!.row).toBe(1); // dragged pinned
    expect(out.find((c) => c.id === "x")!.row).toBe(2); // displaced in g2
    expect(out.find((c) => c.id === "b")!.row).toBe(1); // g1 compacted upward
    expect(out.find((c) => c.id === "b")!.groupId).toBe("g1"); // groupId preserved
  });
});

describe("moveItem", () => {
  it("moves an item down", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
  it("moves an item up", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("is a no-op for an out-of-range from", () => {
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});
