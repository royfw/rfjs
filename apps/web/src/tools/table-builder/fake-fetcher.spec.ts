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

describe('pg filter execution', () => {
  const FIELDS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true, kind: 'column' as const },
    { key: 'author.name', label: 'Author', dataType: 'string' as const, filterable: true, kind: 'jsonb' as const },
  ];
  const ROWS = [
    { id: 1, price: 10, author: { name: 'Ada' } },
    { id: 2, price: 50, author: { name: 'Grace' } },
    { id: 3, price: 90, author: { name: 'Ada' } },
  ];
  const COLUMNS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const },
    { key: 'author.name', label: 'Author', dataType: 'string' as const },
  ];

  function built(filter: unknown) {
    return { endpoint: '/x', method: 'GET' as const, params: { limit: '10', offset: '0' }, filter };
  }

  it('filters by a column leaf (dataType resolved from fields)', async () => {
    const fetcher = makeFakeFetcher(ROWS, COLUMNS, FIELDS);
    const payload = (await fetcher(
      built({ logic: 'and', filters: [{ target: 'column', column: 'price', operator: 'gte', value: 50 }] }),
    )) as { data: { items: unknown[]; total: number } };
    expect(payload.data.total).toBe(2);
    expect(payload.data.items).toHaveLength(2);
  });

  it('filters by a jsonb leaf with a nested path', async () => {
    const fetcher = makeFakeFetcher(ROWS, COLUMNS, FIELDS);
    const payload = (await fetcher(
      built({
        logic: 'and',
        filters: [{ target: 'jsonb', field: 'author.name', dataType: 'string', operator: 'eq', value: 'Ada' }],
      }),
    )) as { data: { items: unknown[]; total: number } };
    expect(payload.data.total).toBe(2);
  });

  it('serves all rows when built carries no filter (back-compat)', async () => {
    const fetcher = makeFakeFetcher(ROWS, COLUMNS, FIELDS);
    const payload = (await fetcher(built(undefined))) as { data: { total: number } };
    expect(payload.data.total).toBe(3);
  });
});
