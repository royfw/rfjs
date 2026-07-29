import { describe, expect, it } from "vitest";

import { getEngine } from "./index";
import type { EngineId } from "./types";

// Issue #279: `contains` must report the SAME arity across every engine adapter,
// or a tree authored against one engine silently mismatches on another (a
// multi-value input pushed to the SQL column layer becomes String(value)).
const ENGINES: EngineId[] = ["data-filter", "sql-filter", "pg-filter", "jsonb"];

function opArity(id: EngineId, op: string, dataType: string, elementType?: string): string | undefined {
  return getEngine(id)
    .operators(dataType, elementType)
    .find((o) => o.op === op)?.arity;
}

function containsArity(id: EngineId, dataType: string, elementType?: string): string | undefined {
  return opArity(id, "contains", dataType, elementType);
}

describe("cross-engine `contains` arity (issue #279)", () => {
  it("agrees on a single arity for string `contains` across all engines", () => {
    const arities = ENGINES.map((id) => containsArity(id, "string"));
    // every engine exposes contains on string...
    for (const [i, a] of arities.entries()) {
      expect(a, `${ENGINES[i]} should expose contains on string`).toBeDefined();
    }
    // ...and they all agree it is single-value ("one")
    expect(new Set(arities)).toEqual(new Set(["one"]));
  });

  it("agrees on a single arity for string-array `contains` (data-filter vs jsonb)", () => {
    const df = containsArity("data-filter", "array", "string");
    const jb = containsArity("jsonb", "array", "string");
    expect(df).toBe("one");
    expect(jb).toBe("one");
    expect(df).toBe(jb);
  });

  it("advertises `icontains` with arity `one` on string-element arrays across data-filter and jsonb", () => {
    const df = opArity("data-filter", "icontains", "array", "string");
    const jb = opArity("jsonb", "icontains", "array", "string");
    expect(df).toBe("one");
    expect(jb).toBe("one");
    expect(df).toBe(jb);
  });
});
