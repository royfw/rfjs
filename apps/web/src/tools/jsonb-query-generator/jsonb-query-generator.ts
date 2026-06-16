import { buildJsonbQuery, type JsonbFilterGroup } from "@rfjs/jsonb-query";

export type JsonbDialect = "legacy" | "jsonpath";
export const JSONB_DIALECTS: JsonbDialect[] = ["legacy", "jsonpath"];

export type JsonbQueryResult =
  | { ok: true; where: string; values: string }
  | { ok: false; error: "invalidJson" | "queryFailed" };

export function runJsonbQuery(column: string, filterText: string, dialect: JsonbDialect): JsonbQueryResult {
  let filter: unknown;
  try {
    filter = JSON.parse(filterText);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  try {
    const { where, values } = buildJsonbQuery(column || "data", filter as JsonbFilterGroup, { dialect });
    return { ok: true, where, values: JSON.stringify(values, null, 2) };
  } catch {
    return { ok: false, error: "queryFailed" };
  }
}
