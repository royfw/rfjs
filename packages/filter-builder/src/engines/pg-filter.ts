import { buildPgFilter, type PgFilterConfig } from "@rfjs/pg-filter";

import { mapColumnType } from "../field-kind";
import { toPgGroup } from "../pg-group";
import { arityOf } from "./arity";
import { jsonbEngine } from "./jsonb";
import type { CompileContext, Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const COLUMN_TEXT_OPS = ["eq", "neq", "contains", "startswith", "endswith", "icontains", "istartswith", "iendswith", "ieq", "ineq", "terms", "gt", "gte", "lt", "lte", ...NULL_OPS];
const COLUMN_NUMERIC_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "terms", "range", ...NULL_OPS]; // numeric + date(timestamp)
const COLUMN_BOOL_OPS = ["eq", "neq", ...NULL_OPS];

function columnOps(dataType: string): string[] {
  if (dataType === "string") return COLUMN_TEXT_OPS;
  if (dataType === "boolean") return COLUMN_BOOL_OPS;
  return COLUMN_NUMERIC_OPS; // numeric, date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
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
