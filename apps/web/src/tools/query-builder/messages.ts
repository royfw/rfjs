import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "query-builder": {
        title: "Query Builder",
        description: "Build nested JSONB queries visually and preview live matches.",
      },
    },
    ToolUI: {
      notPreviewable: "This operator can't be previewed in the browser",
      builder: "Builder",
      elemMatchPlaceholder: "elemmatch (nested match — single-level in this slice)",
      kindColumn: "column",
      kindJsonb: "jsonb",
      topLevelToColumns: "Top-level scalars → columns",
    },
  },
  "zh-TW": {
    Tools: {
      "query-builder": { title: "查詢建構器", description: "視覺化建構巢狀 JSONB 查詢，並即時預覽命中結果。" },
    },
    ToolUI: {
      notPreviewable: "此 operator 無法在瀏覽器預覽",
      builder: "Builder",
      elemMatchPlaceholder: "elemmatch（巢狀比對，本切片暫以單層條件呈現）",
      kindColumn: "欄位",
      kindJsonb: "jsonb",
      topLevelToColumns: "頂層 scalar 設為欄位",
    },
  },
};
