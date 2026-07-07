import { genFilterQuery, type MgoFilterMetadata } from "@rfjs/mongo-query";

export type MongoQueryResult =
  | { ok: true; output: string }
  | { ok: false; error: "invalidJson" | "queryFailed" };

export function runMongoQuery(metaText: string): MongoQueryResult {
  let meta: unknown;
  try {
    meta = JSON.parse(metaText);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  try {
    const query = genFilterQuery(meta as MgoFilterMetadata);
    return { ok: true, output: JSON.stringify(query, null, 2) };
  } catch {
    return { ok: false, error: "queryFailed" };
  }
}
