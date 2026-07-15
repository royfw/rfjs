import { sortRows } from "@rfjs/table-builder";
import type { TableColumnConfig } from "@rfjs/table-builder";
import { filterGroupToTree, runLiveMatch } from "@rfjs/filter-builder";
import type { FilterConditionLike, FilterGroupLike } from "@rfjs/filter-builder";
import type { PgFilterGroup, PgLeaf } from "@rfjs/pg-filter";
import type { DataFieldMeta } from "@rfjs/data-schema";

interface ParsedSort {
  key: string;
  direction: "asc" | "desc";
}

// Decodes both `sort` encodings `buildRequestParams` can produce (colon `key:dir` / signed
// `-key`|`key`) under the single `sort` param name, plus the split `sortBy`+`order` pair.
function parseSort(params: Record<string, string>): ParsedSort | undefined {
  const single = params.sort;
  if (single !== undefined) {
    if (single.startsWith("-")) return { key: single.slice(1), direction: "desc" };
    if (single.includes(":")) {
      const [key, dir] = single.split(":");
      return { key: key ?? "", direction: dir === "desc" ? "desc" : "asc" };
    }
    return { key: single, direction: "asc" };
  }
  if (params.sortBy !== undefined) {
    return { key: params.sortBy, direction: params.order === "desc" ? "desc" : "asc" };
  }
  return undefined;
}

interface PagedResult {
  items: Record<string, unknown>[];
  total: number;
  nextCursor?: string;
}

// Distinguishes the three `PaginationMeta` strategies purely from which params are present:
// offset always sends both `offset`+`limit`; page always sends both `page`+`pageSize`; cursor
// sends `limit` alone on the first page and adds `cursor` (the previous response's `nextCursor`,
// itself a stringified row offset) on subsequent pages.
function paginate(rows: Record<string, unknown>[], params: Record<string, string>): PagedResult {
  if (params.offset !== undefined) {
    const limit = Number(params.limit ?? rows.length);
    const offset = Number(params.offset);
    return { items: rows.slice(offset, offset + limit), total: rows.length };
  }

  if (params.page !== undefined && params.pageSize !== undefined) {
    const pageSize = Number(params.pageSize);
    const page = Number(params.page);
    const start = (page - 1) * pageSize;
    return { items: rows.slice(start, start + pageSize), total: rows.length };
  }

  const limit = Number(params.limit ?? rows.length);
  const offset = params.cursor !== undefined ? Number(params.cursor) : 0;
  const items = rows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const nextCursor = nextOffset < rows.length ? String(nextOffset) : undefined;
  return { items, total: rows.length, nextCursor };
}

// pg 群組 → filter-builder 的 FilterGroupLike:column 葉不帶 dataType,從 fields 反查(spec §3)。
function pgLeafToCondition(leaf: PgLeaf, fields: DataFieldMeta[]): FilterConditionLike {
  if (leaf.target === "column") {
    const meta = fields.find((f) => f.key === leaf.column);
    return { field: leaf.column, dataType: meta?.dataType ?? "string", operator: leaf.operator, value: leaf.value };
  }
  return {
    field: leaf.field,
    dataType: leaf.dataType as FilterConditionLike["dataType"],
    operator: leaf.operator,
    value: leaf.value,
  };
}

function pgGroupToFilterGroup(group: PgFilterGroup, fields: DataFieldMeta[]): FilterGroupLike {
  return {
    logic: group.logic,
    filters: group.filters.map((node) =>
      "logic" in node ? pgGroupToFilterGroup(node as PgFilterGroup, fields) : pgLeafToCondition(node as PgLeaf, fields),
    ),
  };
}

/** built.filter(PgFilterGroup)→ reverse 成 builder 樹 → runLiveMatch 在記憶體執行(dogfood reverse 鏈)。 */
function applyPgFilter(
  rows: Record<string, unknown>[],
  filter: unknown,
  fields: DataFieldMeta[],
): Record<string, unknown>[] {
  if (filter === undefined) return rows;
  const tree = filterGroupToTree(pgGroupToFilterGroup(filter as PgFilterGroup, fields), () => crypto.randomUUID());
  const match = runLiveMatch(rows, tree);
  // 不可覆蓋的運算子:示範資料不該發生;寧可回全量也不要誤報 0 筆
  return match.uncoverable ? rows : (match.matched as Record<string, unknown>[]);
}

/** 純記憶體查詢:filter(pg reverse → runLiveMatch)→ sort → paginate。in-process fake fetcher
 * 與 HTTP route 共用,兩者 dogfood 完全相同的引擎。 */
export function runQuery(
  rows: Record<string, unknown>[],
  columns: TableColumnConfig[],
  fields: DataFieldMeta[],
  built: { params: Record<string, string>; filter?: unknown },
): PagedResult {
  const filtered = applyPgFilter(rows, built.filter, fields);
  const sort = parseSort(built.params);
  const sorted = sort ? sortRows(filtered, sort, columns) : filtered;
  return paginate(sorted, built.params);
}
