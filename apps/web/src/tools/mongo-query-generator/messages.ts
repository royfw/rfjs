import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "mongo-query-generator": {
        title: "Filter → Mongo Query",
        description: "Generate MongoDB queries from filter metadata.",
      },
    },
    ToolUI: {
      mqgEyebrow: "FILTER → MONGO QUERY",
      mqgIntroTagline: "Filter metadata → MongoDB query",
      mqgIntroC1t: "① Describe",
      mqgIntroC1d: "Supply filter metadata (fields, operators, values).",
      mqgIntroC2t: "② Generate",
      mqgIntroC2d: "@rfjs/mongo-query compiles it to a query object.",
      mqgFragment: "Mongo query",
    },
  },
  "zh-TW": {
    Tools: {
      "mongo-query-generator": { title: "篩選 → Mongo 查詢", description: "從篩選 metadata 產生 MongoDB 查詢。" },
    },
    ToolUI: {
      mqgEyebrow: "篩選 → Mongo 查詢",
      mqgIntroTagline: "篩選 metadata → MongoDB 查詢",
      mqgIntroC1t: "① 描述",
      mqgIntroC1d: "給篩選 metadata(欄位、運算子、值)。",
      mqgIntroC2t: "② 產生",
      mqgIntroC2d: "@rfjs/mongo-query 編成查詢物件。",
      mqgFragment: "Mongo 查詢",
    },
  },
};
