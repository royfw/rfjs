import { describe, expect, it } from "vitest";
import { parseDataResourceMeta } from "@rfjs/data-schema";

import {
  DEFAULT_META,
  formatOptionsFor,
  inputsToLabel,
  labelToInputs,
  metaToRows,
  rowsToMeta,
  type FieldRow,
} from "./model";

let n = 0;
const makeId = () => `id-${n++}`;

function row(partial: Partial<FieldRow>): FieldRow {
  return {
    id: "r1",
    key: "k",
    labelEn: "K",
    labelZh: "",
    dataType: "string",
    sortable: false,
    filterable: false,
    options: [],
    ...partial,
  };
}

describe("labelToInputs / inputsToLabel", () => {
  it("string label lands in the en input; round-trips back to a string", () => {
    expect(labelToInputs("Price")).toEqual({ en: "Price", zh: "", rest: undefined });
    expect(inputsToLabel("Price", "")).toBe("Price");
  });

  it("two different values produce an en/zh-TW map; same values collapse to a string", () => {
    expect(inputsToLabel("Price", "價格")).toEqual({ en: "Price", "zh-TW": "價格" });
    expect(inputsToLabel("Price", "Price")).toBe("Price");
  });

  it("preserves other locale keys through a round-trip", () => {
    const src = { en: "Price", "zh-TW": "價格", ja: "価格" };
    const inputs = labelToInputs(src);
    expect(inputs).toEqual({ en: "Price", zh: "價格", rest: { ja: "価格" } });
    expect(inputsToLabel("Cost", inputs.zh, inputs.rest)).toEqual({ en: "Cost", "zh-TW": "價格", ja: "価格" });
  });

  it("zh-only input becomes a plain string", () => {
    expect(inputsToLabel("", "價格")).toBe("價格");
  });
});

describe("metaToRows / rowsToMeta", () => {
  it("round-trips a field including kind/options and omits absent optionals", () => {
    const fields = [
      {
        key: "status",
        label: { en: "Status", "zh-TW": "狀態" },
        dataType: "string" as const,
        filterable: true,
        kind: "column" as const,
        options: [{ value: "draft", label: "Draft" }],
      },
      { key: "price", label: "Price", dataType: "numeric" as const, format: "currency" as const },
    ];
    const rows = metaToRows(fields, makeId);
    expect(rows[0]).toMatchObject({ key: "status", labelEn: "Status", labelZh: "狀態", kind: "column", filterable: true });
    expect(rows[0]!.options[0]).toMatchObject({ value: "draft", labelEn: "Draft" });

    const back = rowsToMeta(rows);
    expect(back).toEqual(fields);
  });

  it("drops rows with a blank key and omits empty options arrays", () => {
    const rows = [row({ key: "  " }), row({ key: "ok", options: [] })];
    const back = rowsToMeta(rows);
    expect(back).toEqual([{ key: "ok", label: "K", dataType: "string" }]);
  });

  it("omits sortable/filterable when false and keeps them when true", () => {
    const back = rowsToMeta([row({ key: "a", sortable: true }), row({ key: "b" })]);
    expect(back[0]).toEqual({ key: "a", label: "K", dataType: "string", sortable: true });
    expect("sortable" in back[1]!).toBe(false);
    expect("filterable" in back[1]!).toBe(false);
  });
});

describe("formatOptionsFor", () => {
  it("filters formats by dataType", () => {
    expect(formatOptionsFor("numeric")).toEqual(["integer", "decimal", "percent", "currency"]);
    expect(formatOptionsFor("date")).toEqual(["date", "datetime", "time"]);
    expect(formatOptionsFor("string")).toEqual([]);
    expect(formatOptionsFor("boolean")).toEqual([]);
  });
});

describe("DEFAULT_META", () => {
  it("passes parseDataResourceMeta and demonstrates kind/filterable/enum/protocol", () => {
    const parsed = parseDataResourceMeta(DEFAULT_META);
    expect(parsed.fields.some((f) => f.kind === "jsonb")).toBe(true);
    expect(parsed.fields.some((f) => (f.options?.length ?? 0) > 0)).toBe(true);
    expect(parsed.request?.filter).toEqual({ style: "pg", param: "filter" });
    expect(parsed.response?.rowsPath).toBe("data.items");
  });
});
