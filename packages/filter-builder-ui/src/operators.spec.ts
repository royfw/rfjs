import { describe, it, expect } from "vitest";
import { ENGINE_IDS, getEngine } from "@rfjs/filter-builder";
import type { FieldKind } from "@rfjs/filter-builder";
import { OPERATOR_KEYS } from "./operators";

// Drift guard: every operator any engine can surface for any field shape must be
// present in OPERATOR_KEYS, so new operators can't slip past the localized list.
describe("OPERATOR_KEYS — drift guard", () => {
  const dataTypes = ["string", "numeric", "date", "boolean", "object", "array"];
  const elementTypes: (string | undefined)[] = [
    undefined,
    "string",
    "numeric",
    "date",
    "boolean",
    "object",
  ];
  const kinds: (FieldKind | undefined)[] = [undefined, "column", "jsonb"];

  it("covers every operator surfaced by every engine for every field shape", () => {
    const known = new Set(OPERATOR_KEYS);
    const missing = new Set<string>();
    for (const engineId of ENGINE_IDS) {
      const engine = getEngine(engineId);
      for (const dataType of dataTypes) {
        for (const elementType of elementTypes) {
          for (const kind of kinds) {
            for (const spec of engine.operators(dataType, elementType, kind)) {
              if (!known.has(spec.op)) missing.add(`${engineId}:${spec.op}`);
            }
          }
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
