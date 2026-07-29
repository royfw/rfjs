import type { FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
// `contains` is single-value (arity "one") to stay portable with the SQL engines
// (see issue #279). data-filter carries the full case-insensitive i-family
// (icontains/istartswith/iendswith/ieq/ineq) so it stays at parity with the
// jsonb/pg/sql adapters (issues #268/#279).
const STRING_OPS = [
  "eq", "neq", "ieq", "ineq",
  "contains", "icontains", "startswith", "istartswith", "endswith", "iendswith", "terms",
  ...NULL_OPS,
];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", "contains", ...NULL_OPS];

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function arrayOps(elementType?: string): string[] {
  if (elementType === "object") return ["elemmatch"];
  // For exact array membership use `terms` (any) / `containsall` (all); `contains`
  // is per-element substring by design, not membership (see issue #267 and the
  // data-filter README operator table).
  if (elementType === "boolean") return ["eq", "containsall", ...NULL_OPS];
  if (elementType === "numeric" || elementType === "date") {
    return ["eq", "gt", "gte", "lt", "lte", "range", "terms", "containsall", ...NULL_OPS];
  }
  // string — advertise the ∃ substring i-ops too (icontains/istartswith/iendswith),
  // which ArrayMatch evaluates per-element via TextMatch, matching the jsonb engine's
  // string-array vocabulary. `ieq`/`ineq` are intentionally omitted: array equality is
  // the dedicated ∃ `eq` path, whereas TextMatch.ieq is ∀-over-elements (issue #279 parity).
  return [
    "eq", "contains", "icontains", "startswith", "istartswith", "endswith", "iendswith",
    "terms", "containsall", ...NULL_OPS,
  ];
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

// Coverage set for live match: every operator data-filter can evaluate.
export const DATA_FILTER_OPS = new Set<string>([
  ...STRING_OPS, ...COMPARABLE_OPS, ...BOOLEAN_OPS, ...OBJECT_OPS,
  "contains", "icontains", "startswith", "istartswith", "endswith", "iendswith",
  "ieq", "ineq", "containsall", "elemmatch",
]);

export const dataFilterEngine: Engine = {
  id: "data-filter",
  label: "data-filter (in-memory)",
  operators(dataType, elementType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(arrayOps(elementType));
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike) {
    return { ok: true, primary: JSON.stringify(group, null, 2) };
  },
};
