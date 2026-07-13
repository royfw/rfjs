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
      fblIntroTagline: "Drag fields on a 12-column grid → live form preview",
      fblIntroC1t: "① Lay out",
      fblIntroC1d: "Drag fields/content onto a 12-column grid, group them.",
      fblIntroC2t: "② Configure",
      fblIntroC2d: "Set per-field type, validation, rules, data source.",
      fblIntroC3t: "③ Preview",
      fblIntroC3d: "The live form (and its result) renders as you build.",
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
      fblIntroTagline: "在 12 欄格線拖欄位 → 即時表單預覽",
      fblIntroC1t: "① 佈局",
      fblIntroC1d: "把欄位/內容拖上 12 欄格線、分組。",
      fblIntroC2t: "② 設定",
      fblIntroC2d: "逐欄設型別、驗證、規則、資料來源。",
      fblIntroC3t: "③ 預覽",
      fblIntroC3d: "即時預覽表單與其結果。",
    },
  },
};
