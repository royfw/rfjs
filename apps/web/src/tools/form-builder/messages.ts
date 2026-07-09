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
      fbAiPlaceholder: "Describe a form or ask a question…",
      fbAiGenerate: "Generate form",
      fbAiExplain: "Explain form",
      fbAiApplied: "Applied ({count} fields)",
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
      fbAiPlaceholder: "描述表單或提出問題…",
      fbAiGenerate: "產生表單",
      fbAiExplain: "解釋表單",
      fbAiApplied: "已套用({count} 個欄位)",
    },
  },
};
