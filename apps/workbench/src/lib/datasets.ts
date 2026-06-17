import type { PgFilterGroup, PgSort } from "@rfjs/pg-filter";

export type Dataset = { id: string; name: string; description: string | null };

/**
 * Distinguishes a reachable-but-empty API (`ok: true, datasets: []`) from an
 * unreachable/erroring one (`ok: false`) so the page can show different states.
 */
export type DatasetsResult = { ok: true; datasets: Dataset[] } | { ok: false };

export async function fetchDatasets(): Promise<DatasetsResult> {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/datasets`, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    return { ok: true, datasets: (await res.json()) as Dataset[] };
  } catch {
    return { ok: false };
  }
}

export type DatasetRow = {
  id: string;
  name: string;
  description: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type QueryDatasetsBody = {
  filter?: PgFilterGroup;
  sort?: PgSort[];
  page?: number;
  pageSize?: number;
};

export type QueryDatasetsResult = {
  items: DatasetRow[];
  total: number;
  page: number;
  pageSize: number;
};

export type QueryResult = { ok: true; result: QueryDatasetsResult } | { ok: false };

export async function queryDatasets(body: QueryDatasetsBody): Promise<QueryResult> {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/datasets/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    return { ok: true, result: (await res.json()) as QueryDatasetsResult };
  } catch {
    return { ok: false };
  }
}
