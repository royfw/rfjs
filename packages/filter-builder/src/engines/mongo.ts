import {
  genFilterQuery,
  type MgoConditionType,
  type MgoFieldCondition,
  type MgoFilterMetadata,
  type ValueType,
} from "@rfjs/mongo-query";
import type { MgoDataType } from "@rfjs/data-transform";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { CompileContext, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const STRING_OPS = ["eq", "neq", "contains", "startswith", "endswith", "terms", "nin", ...NULL_OPS];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", "nin", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", ...NULL_OPS];
const ARRAY_OPS = ["eq", "terms", "nin", ...NULL_OPS];

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

function toMgoDataType(dataType: string): MgoDataType {
  if (dataType === "numeric") return "number";
  if (dataType === "date") return "date";
  if (dataType === "boolean") return "boolean";
  if (dataType === "string") return "string";
  return "any"; // object / array
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Maps one canonical leaf to a mongo-query field condition, transforming the
// value where MongoDB has no direct operator (substring -> $regex, null checks
// -> equality against null).
function toMgoCondition(leaf: FilterConditionLike): MgoFieldCondition {
  const base = { field: leaf.field, dataType: toMgoDataType(leaf.dataType) };
  const v = leaf.value as ValueType;
  switch (leaf.operator) {
    case "eq": case "neq": case "gt": case "gte": case "lt": case "lte":
    case "range": case "terms": case "nin":
      return { ...base, condition: leaf.operator as MgoConditionType, value: v };
    case "contains":
      return { ...base, condition: "regex", value: new RegExp(escapeRegex(String(v))) };
    case "startswith":
      return { ...base, condition: "regex", value: new RegExp("^" + escapeRegex(String(v))) };
    case "endswith":
      return { ...base, condition: "regex", value: new RegExp(escapeRegex(String(v)) + "$") };
    case "isnull":
      return { ...base, condition: "eq", value: null };
    case "isnotnull":
      return { ...base, condition: "neq", value: null };
    default:
      throw new Error("mongoUnsupportedOp:" + leaf.operator);
  }
}

function toMgoGroup(group: FilterGroupLike): MgoFilterMetadata {
  if (group.logic === "not") throw new Error("mongoNoNot");
  return {
    logic: group.logic as MgoFilterMetadata["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toMgoGroup(node as FilterGroupLike)
        : toMgoCondition(node as FilterConditionLike),
    ),
  };
}

// MongoDB values can be RegExp/Date which JSON.stringify would flatten; render
// them as literals so the displayed query is faithful.
function stringifyMongo(query: unknown): string {
  return JSON.stringify(
    query,
    (_k, v) => {
      if (v instanceof RegExp) return v.toString();
      if (v instanceof Date) return v.toISOString();
      return v;
    },
    2,
  );
}

export const mongoEngine: Engine = {
  id: "mongo",
  label: "mongo-query (MongoDB)",
  operators(dataType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(ARRAY_OPS);
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike, _ctx: CompileContext) {
    try {
      const query = genFilterQuery(toMgoGroup(group));
      return { ok: true, primary: stringifyMongo(query) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "queryFailed";
      return { ok: false, error: msg === "mongoNoNot" ? "mongoNoNot" : msg };
    }
  },
};
