import {
  buildColumnQuery,
  type ColumnCondition,
  type ColumnConfig,
  type ColumnOperator,
  type ColumnType,
  type FilterGroup,
} from "@rfjs/sql-filter";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { CompileContext, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
// sql-filter's column layer (ColumnOperator) is the authority on what's renderable.
const TEXT_OPS = ["eq", "neq", "contains", "startswith", "endswith", "icontains", "istartswith", "iendswith", "ieq", "ineq", "terms", "gt", "gte", "lt", "lte", ...NULL_OPS];
const NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "terms", "range", ...NULL_OPS]; // numeric + date
const BOOL_OPS = ["eq", "neq", ...NULL_OPS];

function columnOps(dataType: string): string[] {
  if (dataType === "string") return TEXT_OPS;
  if (dataType === "boolean") return BOOL_OPS;
  if (dataType === "numeric" || dataType === "date") return NUMERIC_OPS;
  return NULL_OPS; // object/array columns: only null checks are meaningful here
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

function toColumnType(dataType: string): ColumnType {
  if (dataType === "numeric") return "numeric";
  if (dataType === "date") return "timestamp";
  if (dataType === "boolean") return "boolean";
  return "text";
}

function toColumnGroup(group: FilterGroupLike): FilterGroup<ColumnCondition> {
  return {
    logic: group.logic as FilterGroup<ColumnCondition>["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toColumnGroup(node as FilterGroupLike)
        : toColumnLeaf(node as FilterConditionLike),
    ),
  };
}

function toColumnLeaf(leaf: FilterConditionLike): ColumnCondition {
  return { column: leaf.field, operator: leaf.operator as ColumnOperator, value: leaf.value };
}

export const sqlFilterEngine: Engine = {
  id: "sql-filter",
  label: "sql-filter (columns)",
  operators(dataType) {
    return toSpecs(columnOps(dataType));
  },
  compile(group: FilterGroupLike, ctx: CompileContext) {
    try {
      const columns = ctx.fields.reduce<ColumnConfig>((acc, f) => {
        acc[f.path] = { column: f.path, type: toColumnType(f.dataType) };
        return acc;
      }, {});
      const { where, values } = buildColumnQuery(columns, toColumnGroup(group));
      return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "queryFailed" };
    }
  },
};
