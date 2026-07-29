import { describe, expect, it } from "vitest";

import type { BuilderGroup, FieldSchema } from "./types";
import { validateTree } from "./validate";

const schema: FieldSchema[] = [
  { path: "title", dataType: "string", include: true, kind: "jsonb" },
  { path: "age", dataType: "numeric", include: true, kind: "column" },
  { path: "roles", dataType: "array", elementType: "string", include: true, kind: "jsonb" },
  { path: "items", dataType: "array", elementType: "object", include: true, kind: "jsonb" },
];

function group(children: BuilderGroup["children"]): BuilderGroup {
  return { kind: "group", id: "root", logic: "and", children };
}

describe("validateTree (issue #278)", () => {
  it("accepts a valid single-level tree", () => {
    const tree = group([
      { kind: "condition", id: "c1", field: "title", dataType: "string", operator: "contains", value: "eng" },
      { kind: "condition", id: "c2", field: "age", dataType: "numeric", operator: "gte", value: 18 },
    ]);
    const r = validateTree(tree, schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tree).toBe(tree);
  });

  it("rejects an empty group (and-of-empty ≡ matches everyone)", () => {
    const r = validateTree(group([]), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain("emptyGroup");
  });

  it("rejects an unknown field, reporting the offending nodeId", () => {
    const tree = group([
      { kind: "condition", id: "bad", field: "nope", dataType: "string", operator: "eq", value: "x" },
    ]);
    const r = validateTree(tree, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual([{ nodeId: "bad", path: "nope", code: "unknownField" }]);
    }
  });

  it("rejects a dataType that disagrees with the field catalog", () => {
    const tree = group([
      { kind: "condition", id: "c", field: "age", dataType: "string", operator: "eq", value: "18" },
    ]);
    const r = validateTree(tree, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain("dataTypeMismatch");
  });

  it("rejects an array condition missing elementType (guards issue #266)", () => {
    const tree = group([
      { kind: "condition", id: "c", field: "roles", dataType: "array", operator: "eq", value: "admin" },
    ]);
    const r = validateTree(tree, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain("missingElementType");
  });

  it("rejects an operator outside the app allowlist", () => {
    const tree = group([
      { kind: "condition", id: "c", field: "title", dataType: "string", operator: "icontains", value: "x" },
    ]);
    const r = validateTree(tree, schema, { operators: { string: ["eq", "contains"] } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain("operatorNotAllowed");
  });

  it("accepts an allowlisted operator", () => {
    const tree = group([
      { kind: "condition", id: "c", field: "title", dataType: "string", operator: "contains", value: "x" },
    ]);
    expect(validateTree(tree, schema, { operators: { string: ["eq", "contains"] } }).ok).toBe(true);
  });

  it("rejects a missing value for a value-bearing operator, but not for null-checks", () => {
    const missing = group([
      { kind: "condition", id: "c", field: "title", dataType: "string", operator: "contains" },
    ]);
    const r = validateTree(missing, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.code)).toContain("missingValue");

    const nullCheck = group([
      { kind: "condition", id: "c", field: "title", dataType: "string", operator: "isnull" },
    ]);
    expect(validateTree(nullCheck, schema).ok).toBe(true);
  });

  it("rejects nested groups when allowNestedGroups is false", () => {
    const tree = group([
      { kind: "group", id: "inner", logic: "or", children: [
        { kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gte", value: 1 },
      ] },
    ]);
    expect(validateTree(tree, schema, { allowNestedGroups: false }).ok).toBe(false);
    expect(validateTree(tree, schema).ok).toBe(true); // allowed by default
  });

  it("rejects a non-group root and non-object input", () => {
    expect(validateTree(null, schema).ok).toBe(false);
    expect(validateTree({ kind: "condition" }, schema).ok).toBe(false);
  });

  it("validates an elemmatch condition as a leaf and does NOT descend into its inner group", () => {
    // Inner conditions reference element-relative paths (sku/qty) absent from the
    // flat top-level schema; recursing would spuriously flag them. Pin: ok:true
    // even though the inner group would be "invalid" against this schema.
    const tree = group([
      {
        kind: "condition", id: "em", field: "items", dataType: "array", elementType: "object",
        operator: "elemmatch",
        filters: {
          kind: "group", id: "ig", logic: "and",
          children: [
            { kind: "condition", id: "s", field: "sku", dataType: "string", operator: "eq", value: "A" },
            { kind: "condition", id: "q", field: "qty", dataType: "numeric", operator: "gt", value: 1 },
          ],
        },
      },
    ]);
    expect(validateTree(tree, schema).ok).toBe(true);
  });

  it("collects errors from multiple offending nodes", () => {
    const tree = group([
      { kind: "condition", id: "a", field: "nope", dataType: "string", operator: "eq", value: "x" },
      { kind: "condition", id: "b", field: "roles", dataType: "array", operator: "eq", value: "admin" },
    ]);
    const r = validateTree(tree, schema);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const ids = r.errors.map((e) => e.nodeId);
      expect(ids).toContain("a");
      expect(ids).toContain("b");
    }
  });
});
