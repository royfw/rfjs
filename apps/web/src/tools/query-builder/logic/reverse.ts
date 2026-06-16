import type { FilterConditionLike, FilterGroupLike } from "./compile";
import type {
  BuilderCondition,
  BuilderGroup,
  BuilderItem,
  ElementType,
  FieldType,
  LogicOp,
} from "./types";

// Inverse of treeToFilterGroup: rebuild an editable tree (with ids) from a
// structural filter group. Round-trips: treeToFilterGroup(filterGroupToTree(g)) === g
// for groups whose leaves are complete (field + operator present).
export function filterGroupToTree(group: FilterGroupLike, makeId: () => string): BuilderGroup {
  return {
    kind: "group",
    id: makeId(),
    logic: group.logic as LogicOp,
    children: group.filters.map((item) => toItem(item, makeId)),
  };
}

function toItem(item: FilterConditionLike | FilterGroupLike, makeId: () => string): BuilderItem {
  return "field" in item ? toCondition(item, makeId) : filterGroupToTree(item, makeId);
}

function toCondition(c: FilterConditionLike, makeId: () => string): BuilderCondition {
  const out: BuilderCondition = {
    kind: "condition",
    id: makeId(),
    field: c.field,
    dataType: c.dataType as FieldType,
    operator: c.operator,
  };
  if (c.elementType) out.elementType = c.elementType as ElementType;
  if (c.operator === "elemmatch" && c.filters) {
    out.filters = filterGroupToTree(c.filters, makeId);
  } else if (c.value !== undefined) {
    out.value = c.value;
  }
  return out;
}

export type ReverseError = "invalidJson" | "invalidShape";

const LOGIC_OPS: readonly string[] = ["and", "or", "nor", "not"];

export function parseFilterGroup(
  text: string,
): { ok: true; group: FilterGroupLike } | { ok: false; error: ReverseError } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (!isValidGroup(parsed)) return { ok: false, error: "invalidShape" };
  return { ok: true, group: parsed as FilterGroupLike };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidGroup(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (typeof v.logic !== "string" || !LOGIC_OPS.includes(v.logic)) return false;
  if (!Array.isArray(v.filters)) return false;
  return v.filters.every(isValidItem);
}

function isValidItem(v: unknown): boolean {
  if (!isObject(v)) return false;
  return "field" in v ? isValidLeaf(v) : isValidGroup(v);
}

function isValidLeaf(v: Record<string, unknown>): boolean {
  if (typeof v.field !== "string" || v.field.length === 0) return false;
  if (typeof v.dataType !== "string") return false;
  if (typeof v.operator !== "string" || v.operator.length === 0) return false;
  if (v.operator === "elemmatch" && v.filters !== undefined) return isValidGroup(v.filters);
  return true;
}
