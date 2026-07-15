import { describe, it, expect } from "vitest";
import { runQuery } from "./fake-query";
import type { TableColumnConfig } from "@rfjs/table-builder";
import type { DataFieldMeta } from "@rfjs/data-schema";

const fields: DataFieldMeta[] = [
  { key: "id", label: "ID", dataType: "numeric", filterable: true, kind: "column" },
  { key: "name", label: "Name", dataType: "string", filterable: true, kind: "column" },
];
const columns: TableColumnConfig[] = [
  { key: "id", label: "ID", dataType: "numeric" },
  { key: "name", label: "Name", dataType: "string" },
];
const rows = [
  { id: 1, name: "Ada" },
  { id: 2, name: "Alan" },
  { id: 3, name: "Grace" },
];

describe("runQuery", () => {
  it("no filter → all rows, total = length", () => {
    const r = runQuery(rows, columns, fields, { params: {} });
    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(3);
  });

  it("applies a column filter (eq)", () => {
    const filter = { logic: "and", filters: [{ target: "column", column: "name", operator: "eq", value: "Ada" }] };
    const r = runQuery(rows, columns, fields, { params: {}, filter });
    expect(r.items).toEqual([{ id: 1, name: "Ada" }]);
    expect(r.total).toBe(1);
  });

  it("sorts + paginates (page strategy)", () => {
    const r = runQuery(rows, columns, fields, { params: { page: "1", pageSize: "2", sort: "-id" } });
    expect(r.items.map((x) => x.id)).toEqual([3, 2]);
    expect(r.total).toBe(3);
  });
});
