import { deriveTableConfig } from "@rfjs/table-builder";
import type { DataResourceMeta, PaginationMeta } from "@rfjs/data-schema";
import type { TableConfig } from "@rfjs/table-builder";

/** Editor source-panel state (Task 9, design spec §6.1): 'rows' is the static in-memory source;
 * the other three select the fake-fetcher remote source under a given `PaginationMeta` strategy. */
export type SourceMode = "rows" | "offset" | "page" | "cursor";

/**
 * Sample resource metadata (design spec §6.1/§6.2): one column per scalar kind the contract
 * supports -- plain string, numeric+currency, date, boolean, a dot-path into a nested object
 * (`author.name`), and an enum column driven by `options`. `request`/`response` describe the
 * offset-paginated shape the fake fetcher in `./fake-fetcher.ts` actually serves; the
 * `data.items` / `data.total` / `data.nextCursor` response paths are shared across all three
 * pagination strategies the fetcher simulates (offset/page/cursor), so switching strategy in the
 * (future) editor only changes `request.pagination`, never `response`.
 */
export const SAMPLE_META: DataResourceMeta = {
  fields: [
    { key: "id", label: "ID", dataType: "string", sortable: true },
    { key: "title", label: "Title", dataType: "string", sortable: true, filterable: true, kind: "column" },
    {
      key: "price",
      label: "Price",
      dataType: "numeric",
      format: "currency",
      sortable: true,
      filterable: true,
      kind: "column",
    },
    { key: "createdAt", label: "Created", dataType: "date", format: "date", sortable: true },
    { key: "inStock", label: "In stock", dataType: "boolean" },
    { key: "author.name", label: "Author", dataType: "string", sortable: true, filterable: true, kind: "jsonb" },
    {
      key: "status",
      label: "Status",
      dataType: "string",
      filterable: true,
      kind: "column",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ],
    },
  ],
  request: {
    endpoint: "/api/sample/items",
    method: "GET",
    pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
    sort: { style: "single", param: "sort", encoding: "colon" },
    filter: { style: "pg", param: "filter" },
  },
  response: { rowsPath: "data.items", totalPath: "data.total", cursorPath: "data.nextCursor" },
};

const AUTHORS = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson"];
const STATUSES = ["draft", "published", "archived"] as const;

/** 18 rows -- enough to exercise multi-page pagination without a second data shape. */
export const SAMPLE_ROWS: Record<string, unknown>[] = Array.from({ length: 18 }, (_, i) => {
  const n = i + 1;
  return {
    id: `bk-${String(n).padStart(3, "0")}`,
    title: `Sample Item ${n}`,
    price: Math.round((10 + n * 3.5) * 100) / 100,
    createdAt: `2026-01-${String((n % 28) + 1).padStart(2, "0")}`,
    inStock: n % 3 !== 0,
    author: { name: AUTHORS[n % AUTHORS.length] },
    status: STATUSES[n % STATUSES.length],
  };
});

/**
 * `deriveTableConfig` is a one-way compile (design spec §4.2); the tweaks below happen on the
 * derived, re-editable `TableConfig` -- they never feed back into `SAMPLE_META`. Pins the `id`
 * column left and offers a couple of page-size choices so the static preview shows off more of
 * `<ConfigTable>` than the deriver's own defaults.
 */
export const SAMPLE_CONFIG: TableConfig = (() => {
  const config = deriveTableConfig(SAMPLE_META);
  const idColumn = config.columns.find((c) => c.key === "id");
  if (idColumn) idColumn.pin = "left";
  config.pagination = { pageSize: 5, pageSizeOptions: [5, 10, 20] };
  return config;
})();

/**
 * Derives the `PaginationMeta` for a fetcher `SourceMode` (design spec §6.2): all three strategies
 * share `SAMPLE_META.request`'s `endpoint`/`sort`, only `pagination` differs. Param names match what
 * `./fake-fetcher.ts#paginate` already discriminates strategies by (offset+limit / page+pageSize /
 * cursor+limit).
 */
export function samplePaginationMeta(strategy: Exclude<SourceMode, "rows">): PaginationMeta {
  switch (strategy) {
    case "offset":
      return { strategy: "offset", limitParam: "limit", offsetParam: "offset" };
    case "page":
      return { strategy: "page", pageParam: "page", pageSizeParam: "pageSize" };
    case "cursor":
      return { strategy: "cursor", cursorParam: "cursor", limitParam: "limit" };
  }
}
