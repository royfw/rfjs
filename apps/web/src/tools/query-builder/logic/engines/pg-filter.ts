import { buildPgFilter, type PgFilterConfig, type PgFilterGroup, type PgLeaf } from "@rfjs/pg-filter";

import type { FilterConditionLike, FilterGroupLike } from "../compile";
import { mapColumnType } from "../field-kind";
import { arityOf } from "./arity";
import { jsonbEngine } from "./jsonb";
import type { CompileContext, CompileField, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const COLUMN_TEXT_OPS = ["eq", "neq", "contains", "startswith", "gt", "gte", "lt", "lte", ...NULL_OPS];
const COLUMN_NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", ...NULL_OPS]; // numeric + date(timestamp)
const COLUMN_BOOL_OPS = ["eq", "neq", ...NULL_OPS];

function columnOps(dataType: string): string[] {
  if (dataType === "string") return COLUMN_TEXT_OPS;
  if (dataType === "boolean") return COLUMN_BOOL_OPS;
  return COLUMN_NUMERIC_OPS; // numeric, date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

function toPgLeaf(c: FilterConditionLike, byPath: Map<string, CompileField>): PgLeaf {
  const f = byPath.get(c.field);
  const kind = f?.kind ?? "jsonb";
  if (kind === "column") {
    return { target: "column", column: c.field, operator: c.operator, value: c.value } as PgLeaf;
  }
  const leaf = {
    target: "jsonb",
    field: c.field,
    dataType: f?.dataType ?? c.dataType,
    operator: c.operator,
    ...(c.value !== undefined ? { value: c.value } : {}),
    ...((f?.elementType ?? c.elementType) ? { elementType: f?.elementType ?? c.elementType } : {}),
    ...(c.filters ? { filters: c.filters } : {}),
  };
  return leaf as unknown as PgLeaf;
}

function toPgGroup(group: FilterGroupLike, byPath: Map<string, CompileField>): PgFilterGroup {
  return {
    logic: group.logic as PgFilterGroup["logic"],
    filters: group.filters.map((node) =>
      "logic" in node
        ? toPgGroup(node as FilterGroupLike, byPath)
        : toPgLeaf(node as FilterConditionLike, byPath),
    ),
  };
}

export const pgFilterEngine: Engine = {
  id: "pg-filter",
  label: "pg-filter (column + jsonb)",
  operators(dataType, elementType, kind) {
    if (kind === "column") return toSpecs(columnOps(dataType));
    return jsonbEngine.operators(dataType, elementType);
  },
  compile(group, ctx: CompileContext) {
    try {
      const byPath = new Map(ctx.fields.map((f) => [f.path, f]));
      const columns = ctx.fields
        .filter((f) => f.kind === "column")
        .reduce<PgFilterConfig["columns"]>((acc, f) => {
          acc[f.path] = { column: f.path, type: mapColumnType(f.dataType) };
          return acc;
        }, {});
      const config: PgFilterConfig = { columns, jsonb: { column: "data", dialect: "legacy" } };
      const { where, values } = buildPgFilter(config, { filter: toPgGroup(group, byPath) });
      return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "queryFailed" };
    }
  },
};
