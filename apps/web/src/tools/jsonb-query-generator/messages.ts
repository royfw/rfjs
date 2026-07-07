import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "jsonb-query-generator": {
        title: "Filter → JSONB SQL",
        description: "Generate PostgreSQL JSONB queries from filter metadata.",
      },
    },
    ToolUI: { column: "Column", dialect: "Dialect" },
  },
  "zh-TW": {
    Tools: {
      "jsonb-query-generator": { title: "篩選 → JSONB SQL", description: "從篩選 metadata 產生 PostgreSQL JSONB 查詢。" },
    },
    ToolUI: { column: "欄位", dialect: "方言" },
  },
};
