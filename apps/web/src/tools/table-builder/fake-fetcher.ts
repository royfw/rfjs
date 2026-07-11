import type { TableColumnConfig } from "@rfjs/table-builder";
import type { BuiltRequest, DataFieldMeta } from "@rfjs/data-schema";
import { runQuery } from "@/lib/fake-query";

// A live example of the `DataResourceMeta` request/response contract (design spec §6.2): the
// same in-memory rows are served under all three pagination strategies (offset/page/cursor) plus
// server-side sort, purely by reading the param names `buildRequestParams` produces for each
// strategy -- so the fetcher never needs to be told which strategy is in play, only the rows/
// columns to serve. Response shape is always `{ data: { items, total, nextCursor? } }`, matching
// `SAMPLE_META.response` (`data.items` / `data.total` / `data.nextCursor`). The actual filter →
// sort → paginate logic lives in `@/lib/fake-query` (`runQuery`), shared with the HTTP route.

const FAKE_FETCH_DELAY_MS = 120;

/**
 * Builds a fake `TableSource['fetch']` implementation over static `rows`. `columns` is needed
 * only to pick the right comparator per `sortRows` (dataType-aware); pagination/sort strategy is
 * inferred entirely from `built.params` (see `runQuery`). Resolves after a fixed delay so the
 * tool page's loading state is actually visible.
 */
export function makeFakeFetcher(
  rows: Record<string, unknown>[],
  columns: TableColumnConfig[],
  fields: DataFieldMeta[] = [],
): (built: BuiltRequest) => Promise<unknown> {
  return (built: BuiltRequest): Promise<unknown> => {
    const { items, total, nextCursor } = runQuery(rows, columns, fields, built);

    const data: Record<string, unknown> = { items, total };
    if (nextCursor !== undefined) data.nextCursor = nextCursor;

    return new Promise((resolve) => {
      setTimeout(() => resolve({ data }), FAKE_FETCH_DELAY_MS);
    });
  };
}
