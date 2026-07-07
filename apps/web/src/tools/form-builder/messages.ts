import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "form-builder": {
        title: "Form Builder",
        description:
          "A 2D form builder — drag fields on a 12-column grid, group them, set per-field config, and preview live.",
      },
    },
    ToolUI: {
      fbAiPlaceholder: "Describe the form you want…",
      fbAiGenerate: "AI Generate",
      fbAiCancel: "Cancel",
      fbAiNotConfigured: "Set up an AI connection first (top-right ✨).",
      fbAiViewRaw: "View raw output",
    },
  },
  "zh-TW": {
    Tools: {
      "form-builder": {
        title: "表單建構器",
        description: "2D 表單建構器：在 12 欄網格上拖放欄位、分組、設定每欄屬性,並即時預覽。",
      },
    },
    ToolUI: {
      fbAiPlaceholder: "用白話描述你要的表單…",
      fbAiGenerate: "AI 產生",
      fbAiCancel: "取消",
      fbAiNotConfigured: "請先設定 AI 連線(右上 ✨)。",
      fbAiViewRaw: "檢視原始輸出",
    },
  },
};
