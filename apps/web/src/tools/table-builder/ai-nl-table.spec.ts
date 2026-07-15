import { describe, expect, it } from "vitest";

import type { TableConfig } from "@rfjs/table-builder";

import { buildNlTablePrompt, buildTableAskPrompt, parseNlTableResponse } from "./ai-nl-table";

const CONFIG: TableConfig = {
  columns: [{ key: "price", label: "Price", dataType: "numeric" }],
  pagination: { pageSize: 5 },
};
const VALID_JSON = JSON.stringify(CONFIG);

describe("buildNlTablePrompt", () => {
  it("embeds the current config and the key-preservation rule; user is the raw nl", () => {
    const p = buildNlTablePrompt("hide the price column", CONFIG);
    expect(p.system).toContain('"price"'); // current config embedded
    expect(p.system).toContain("never add or remove"); // key-set rule
    expect(p.system).toContain("JSON"); // json-only instruction
    expect(p.user).toBe("hide the price column");
  });
});

describe("buildTableAskPrompt", () => {
  it("embeds config json and locale in system; user is the question", () => {
    const p = buildTableAskPrompt({ configJson: VALID_JSON, locale: "zh-TW" }, "這個表格顯示什麼?");
    expect(p.system).toContain(VALID_JSON);
    expect(p.system).toContain("zh-TW");
    expect(p.user).toBe("這個表格顯示什麼?");
  });
});

describe("parseNlTableResponse", () => {
  it("accepts a valid TableConfig and returns normalized json", () => {
    const out = parseNlTableResponse(VALID_JSON);
    expect(JSON.parse(out)).toEqual(CONFIG);
  });

  it("strips a markdown code fence before parsing", () => {
    const out = parseNlTableResponse("```json\n" + VALID_JSON + "\n```");
    expect(JSON.parse(out)).toEqual(CONFIG);
  });

  it("throws on malformed json", () => {
    expect(() => parseNlTableResponse("not json {")).toThrow();
  });

  it("throws on schema-invalid config (pageSize must be a positive int)", () => {
    const bad = JSON.stringify({ columns: CONFIG.columns, pagination: { pageSize: 0 } });
    expect(() => parseNlTableResponse(bad)).toThrow();
  });

  it("throws on incompatible format for the dataType", () => {
    const bad = JSON.stringify({
      columns: [{ key: "price", label: "Price", dataType: "string", format: "currency" }],
      pagination: { pageSize: 5 },
    });
    expect(() => parseNlTableResponse(bad)).toThrow();
  });
});
