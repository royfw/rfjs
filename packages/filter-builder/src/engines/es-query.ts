import {
  buildEsQuery,
  type EsConditionType,
  type EsFieldCondition,
  type EsFilterMetadata,
} from "@rfjs/es-query";
import type { DataType, ValueType } from "@rfjs/data-transform";

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

function toEsDataType(dataType: string): DataType {
  if (dataType === "numeric") return "number";
  if (dataType === "date") return "date";
  if (dataType === "boolean") return "boolean";
  if (dataType === "string") return "string";
  return "any"; // object / array
}

// Canonical builder operator -> es-query condition.
const OP_MAP: Record<string, EsConditionType> = {
  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  range: "between",
  terms: "in",
  nin: "notIn",
  contains: "contains",
  startswith: "startsWith",
  endswith: "endsWith",
  isnull: "isNull",
  isnotnull: "exists",
};

function toEsCondition(leaf: FilterConditionLike): EsFieldCondition {
  const condition = OP_MAP[leaf.operator];
  if (!condition) throw new Error("esUnsupportedOp:" + leaf.operator);
  return {
    field: leaf.field,
    condition,
    dataType: toEsDataType(leaf.dataType),
    value: leaf.value as ValueType | ValueType[],
  };
}

function toEsGroup(group: FilterGroupLike): EsFilterMetadata {
  return {
    logic: group.logic as EsFilterMetadata["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toEsGroup(node as FilterGroupLike)
        : toEsCondition(node as FilterConditionLike),
    ),
  };
}

export const esQueryEngine: Engine = {
  id: "es-query",
  label: "es-query (Elasticsearch / OpenSearch)",
  operators(dataType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(ARRAY_OPS);
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike, _ctx: CompileContext) {
    try {
      const query = buildEsQuery(toEsGroup(group), { dialect: "elasticsearch" });
      return { ok: true, primary: JSON.stringify(query, null, 2) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "queryFailed";
      return { ok: false, error: msg };
    }
  },
};
