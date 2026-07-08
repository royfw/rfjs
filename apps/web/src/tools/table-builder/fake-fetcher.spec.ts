import { describe, expect, it } from "vitest";
import { buildRequestParams } from "@rfjs/data-schema";
import type { RequestMeta } from "@rfjs/data-schema";
import { pageToOffset } from "@rfjs/table-builder";
import type { TableColumnConfig } from "@rfjs/table-builder";

import { makeFakeFetcher } from "./fake-fetcher";

interface Row {
  id: string;
  n: number;
}

const ROWS: Row[] = Array.from({ length: 20 }, (_, i) => ({ id: `r${i + 1}`, n: i + 1 }));

const COLUMNS: TableColumnConfig[] = [
  { key: "id", label: "ID", dataType: "string" },
  { key: "n", label: "N", dataType: "numeric", sortable: true },
];

const OFFSET_REQUEST: RequestMeta = {
  endpoint: "/x",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
  sort: { style: "single", param: "sort", encoding: "colon" },
};

const PAGE_REQUEST: RequestMeta = {
  endpoint: "/x",
  pagination: { strategy: "page", pageParam: "page", pageSizeParam: "pageSize" },
};

const CURSOR_REQUEST: RequestMeta = {
  endpoint: "/x",
  pagination: { strategy: "cursor", cursorParam: "cursor", limitParam: "limit" },
};

async function fetchAs(fetcher: ReturnType<typeof makeFakeFetcher>, built: ReturnType<typeof buildRequestParams>) {
  const payload = (await fetcher(built)) as { data: { items: Row[]; total: number; nextCursor?: string } };
  return payload.data;
}

describe("makeFakeFetcher", () => {
  it("offset strategy: page 2 (pageSize 10) returns rows 11-20", async () => {
    const fetcher = makeFakeFetcher(ROWS as unknown as Record<string, unknown>[], COLUMNS);
    const built = buildRequestParams(OFFSET_REQUEST, { pageSize: 10, offset: pageToOffset(2, 10) });
    const { items, total } = await fetchAs(fetcher, built);
    expect(items.map((r) => r.n)).toEqual(Array.from({ length: 10 }, (_, i) => i + 11));
    expect(total).toBe(20);
  });

  it("page strategy: page 2 (pageSize 10) returns rows 11-20", async () => {
    const fetcher = makeFakeFetcher(ROWS as unknown as Record<string, unknown>[], COLUMNS);
    const built = buildRequestParams(PAGE_REQUEST, { pageSize: 10, page: 2 });
    const { items } = await fetchAs(fetcher, built);
    expect(items.map((r) => r.n)).toEqual(Array.from({ length: 10 }, (_, i) => i + 11));
  });

  it("sort param reorders results (server-side sort simulation)", async () => {
    const fetcher = makeFakeFetcher(ROWS as unknown as Record<string, unknown>[], COLUMNS);
    const built = buildRequestParams(OFFSET_REQUEST, {
      pageSize: 20,
      offset: 0,
      sort: { key: "n", direction: "desc" },
    });
    const { items } = await fetchAs(fetcher, built);
    expect(items[0]?.n).toBe(20);
    expect(items[items.length - 1]?.n).toBe(1);
  });

  it("cursor strategy: walks pages via nextCursor and stops with no cursor on the last page", async () => {
    const fetcher = makeFakeFetcher(ROWS as unknown as Record<string, unknown>[], COLUMNS);

    const page1 = await fetchAs(fetcher, buildRequestParams(CURSOR_REQUEST, { pageSize: 5 }));
    expect(page1.items.map((r) => r.n)).toEqual([1, 2, 3, 4, 5]);
    expect(page1.nextCursor).toBe("5");

    const page2 = await fetchAs(fetcher, buildRequestParams(CURSOR_REQUEST, { pageSize: 5, cursor: page1.nextCursor }));
    expect(page2.items.map((r) => r.n)).toEqual([6, 7, 8, 9, 10]);
    expect(page2.nextCursor).toBe("10");

    const page4 = await fetchAs(fetcher, buildRequestParams(CURSOR_REQUEST, { pageSize: 5, cursor: "15" }));
    expect(page4.items.map((r) => r.n)).toEqual([16, 17, 18, 19, 20]);
    expect(page4.nextCursor).toBeUndefined();
  });
});
