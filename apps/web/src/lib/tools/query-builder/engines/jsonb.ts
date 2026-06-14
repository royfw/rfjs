import { buildJsonbQuery, type JsonbFilterGroup } from "@rfjs/jsonb-query";

import type { FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const STRING_OPS = [
  "eq", "neq", "contains", "icontains", "startswith", "istartswith",
  "endswith", "iendswith", "ieq", "ineq", "terms", ...NULL_OPS,
];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", "contains", "haskey", "hasanykey", "hasallkeys", ...NULL_OPS];
const ARRAY_EMPTY_OPS = ["isempty", "isnotempty"];

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

export const jsonbEngine: Engine = {
  id: "jsonb",
  label: "jsonb-query (PostgreSQL)",
  operators(dataType, elementType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") {
      if (elementType === "object") return toSpecs(["elemmatch"]);
      const base = elementType ? scalarOps(elementType) : STRING_OPS;
      return toSpecs([...base, "contains", "containsall", ...ARRAY_EMPTY_OPS]);
    }
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike) {
    try {
      const { where, values } = buildJsonbQuery("data", group as unknown as JsonbFilterGroup, {
        dialect: "legacy",
      });
      return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "queryFailed" };
    }
  },
};
