import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "jsonb-query-generator": {
        title: "Filter → JSONB SQL",
        description: "Generate PostgreSQL JSONB queries from filter metadata.",
      },
    },
    ToolUI: {
      column: "Column",
      dialect: "Dialect",
      jqgIntroTagline: "Filter metadata → PostgreSQL JSONB query",
      jqgIntroC1t: "① Describe",
      jqgIntroC1d: "Supply filter metadata (fields, operators, values).",
      jqgIntroC2t: "② Generate",
      jqgIntroC2d: "@rfjs/jsonb-query compiles it to a JSONB WHERE / ORDER BY.",
    },
  },
  "zh-TW": {
    Tools: {
      "jsonb-query-generator": { title: "篩選 → JSONB SQL", description: "從篩選 metadata 產生 PostgreSQL JSONB 查詢。" },
    },
    ToolUI: {
      column: "欄位",
      dialect: "方言",
      jqgIntroTagline: "篩選 metadata → PostgreSQL JSONB 查詢",
      jqgIntroC1t: "① 描述",
      jqgIntroC1d: "給篩選 metadata(欄位、運算子、值)。",
      jqgIntroC2t: "② 產生",
      jqgIntroC2d: "@rfjs/jsonb-query 編成 JSONB WHERE / ORDER BY。",
    },
  },
};
