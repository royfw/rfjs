import type { FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const STRING_OPS = ["eq", "neq", "contains", "startswith", "endswith", "terms", ...NULL_OPS];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", "contains", ...NULL_OPS];

// data-filter evaluates `contains` over a list of values (match if the target
// contains ANY of them — see @rfjs/data-filter TextMatch.contains), so on string
// fields `contains` is exposed as a multi-value op rather than a single value.
const STRING_LIST_OPS = new Set(["contains"]);

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function arrayOps(elementType?: string): string[] {
  if (elementType === "object") return ["elemmatch"];
  if (elementType === "boolean") return ["eq", "containsall", ...NULL_OPS];
  if (elementType === "numeric" || elementType === "date") {
    return ["eq", "gt", "gte", "lt", "lte", "range", "terms", "containsall", ...NULL_OPS];
  }
  return ["eq", "contains", "startswith", "endswith", "terms", "containsall", ...NULL_OPS]; // string
}

function toSpecs(ops: string[], listOps?: Set<string>): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({
    op,
    arity: listOps?.has(op) ? "list" : arityOf(op),
  }));
}

// Coverage set for live match: every operator data-filter can evaluate.
export const DATA_FILTER_OPS = new Set<string>([
  ...STRING_OPS, ...COMPARABLE_OPS, ...BOOLEAN_OPS, ...OBJECT_OPS,
  "contains", "startswith", "endswith", "containsall", "elemmatch",
]);

export const dataFilterEngine: Engine = {
  id: "data-filter",
  label: "data-filter (in-memory)",
  operators(dataType, elementType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(arrayOps(elementType));
    if (dataType === "string") return toSpecs(STRING_OPS, STRING_LIST_OPS);
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike) {
    return { ok: true, primary: JSON.stringify(group, null, 2) };
  },
};
