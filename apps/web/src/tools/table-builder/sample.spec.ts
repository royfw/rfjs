import { describe, expect, it } from "vitest";
import { parseDataResourceMeta } from "@rfjs/data-schema";
import { parseTableConfig } from "@rfjs/table-builder";

import { SAMPLE_CONFIG, SAMPLE_META, SAMPLE_ROWS } from "./sample";

describe("table-builder sample data", () => {
  it("SAMPLE_META is a valid DataResourceMeta", () => {
    expect(() => parseDataResourceMeta(SAMPLE_META)).not.toThrow();
  });

  it("covers every scalar kind: string, numeric+currency, date, boolean, nested key, enum options", () => {
    const byKey = new Map(SAMPLE_META.fields.map((f) => [f.key, f]));
    expect(byKey.get("title")?.dataType).toBe("string");
    expect(byKey.get("price")).toMatchObject({ dataType: "numeric", format: "currency" });
    expect(byKey.get("createdAt")).toMatchObject({ dataType: "date", format: "date" });
    expect(byKey.get("inStock")?.dataType).toBe("boolean");
    expect(byKey.get("author.name")?.dataType).toBe("string");
    expect(byKey.get("status")?.options?.map((o) => o.value)).toEqual(["draft", "published", "archived"]);
  });

  it("SAMPLE_ROWS has 15-20 rows shaped to match SAMPLE_META's fields", () => {
    expect(SAMPLE_ROWS.length).toBeGreaterThanOrEqual(15);
    expect(SAMPLE_ROWS.length).toBeLessThanOrEqual(20);
    for (const row of SAMPLE_ROWS) {
      expect(typeof row.id).toBe("string");
      expect(typeof row.title).toBe("string");
      expect(typeof row.price).toBe("number");
      expect(typeof row.createdAt).toBe("string");
      expect(typeof row.inStock).toBe("boolean");
      expect(typeof (row.author as { name: string }).name).toBe("string");
      expect(["draft", "published", "archived"]).toContain(row.status);
    }
  });

  it("SAMPLE_CONFIG is a valid TableConfig", () => {
    expect(() => parseTableConfig(SAMPLE_CONFIG)).not.toThrow();
  });

  it("SAMPLE_CONFIG pins the id column left and carries sortable flags from SAMPLE_META", () => {
    const idColumn = SAMPLE_CONFIG.columns.find((c) => c.key === "id");
    expect(idColumn?.pin).toBe("left");
    const titleColumn = SAMPLE_CONFIG.columns.find((c) => c.key === "title");
    expect(titleColumn?.sortable).toBe(true);
    const inStockColumn = SAMPLE_CONFIG.columns.find((c) => c.key === "inStock");
    expect(inStockColumn?.sortable).toBeFalsy();
  });
});
