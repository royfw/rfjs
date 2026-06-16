import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "query-builder": {
        title: "Query Builder",
        description: "Build nested filters over real columns and JSONB, and preview the generated SQL (jsonb / data-filter / pg-filter).",
      },
    },
    ToolUI: {
      notPreviewable: "This operator can't be previewed in the browser",
      builder: "Builder",
      elemMatchPlaceholder: "elemmatch (nested match — single-level in this slice)",
      kindColumn: "column",
      kindJsonb: "jsonb",
      topLevelToColumns: "Top-level scalars → columns",
      canonicalEditable: "Canonical filter (editable) — edit to rebuild the query",
      reverseInvalidJson: "Invalid JSON",
      reverseInvalidShape: "Not a valid filter group",
    },
  },
  "zh-TW": {
    Tools: {
      "query-builder": { title: "查詢建構器", description: "在真實欄位與 JSONB 上建構巢狀過濾，並預覽產生的 SQL（jsonb / data-filter / pg-filter）。" },
    },
    ToolUI: {
      notPreviewable: "此 operator 無法在瀏覽器預覽",
      builder: "Builder",
      elemMatchPlaceholder: "elemmatch（巢狀比對，本切片暫以單層條件呈現）",
      kindColumn: "欄位",
      kindJsonb: "jsonb",
      topLevelToColumns: "頂層 scalar 設為欄位",
      canonicalEditable: "Canonical 篩選(可編輯)—— 編輯即反推查詢",
      reverseInvalidJson: "無效的 JSON",
      reverseInvalidShape: "不是合法的 filter group",
    },
  },
};
