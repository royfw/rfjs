import type { PgFilterConfig } from "@rfjs/pg-filter";

import type { FieldType } from "./types";

// Derive the SQL column type union from pg-filter's config shape (avoids a direct
// @rfjs/sql-filter import; stays in sync with the package).
export type SqlColumnType = PgFilterConfig["columns"][string]["type"];

const COLUMN_TYPE_BY_DATATYPE: Partial<Record<FieldType, SqlColumnType>> = {
  string: "text",
  numeric: "numeric",
  date: "timestamp",
  boolean: "boolean",
};

export function canBeColumn(dataType: FieldType): boolean {
  return dataType in COLUMN_TYPE_BY_DATATYPE;
}

export function mapColumnType(dataType: FieldType): SqlColumnType {
  const t = COLUMN_TYPE_BY_DATATYPE[dataType];
  if (!t) throw new Error(`dataType "${dataType}" cannot be a SQL column`);
  return t;
}
