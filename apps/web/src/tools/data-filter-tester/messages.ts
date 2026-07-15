import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "data-filter-tester": {
        title: "JSONPath Filter Tester",
        description: "Run @rfjs/data-filter conditions against sample data live.",
      },
    },
    ToolUI: {
      dftEyebrow: "JSONPATH FILTER TESTER",
      dftIntroTagline: "Test @rfjs/data-filter conditions against sample data",
      dftIntroC1t: "① Write",
      dftIntroC1d: "A data-filter condition (JSONPath-style).",
      dftIntroC2t: "② Run",
      dftIntroC2d: "It evaluates against the sample data live.",
      dftIntroC3t: "③ Live",
      dftIntroC3d: "Matched results update as you type.",
    },
  },
  "zh-TW": {
    Tools: {
      "data-filter-tester": {
        title: "JSONPath 篩選測試器",
        description: "對範例資料即時執行 @rfjs/data-filter 條件。",
      },
    },
    ToolUI: {
      dftEyebrow: "JSONPath 篩選測試器",
      dftIntroTagline: "拿 @rfjs/data-filter 條件對範例資料試跑",
      dftIntroC1t: "① 撰寫",
      dftIntroC1d: "一條 data-filter 條件(JSONPath 風格)。",
      dftIntroC2t: "② 試跑",
      dftIntroC2d: "對範例資料即時求值。",
      dftIntroC3t: "③ 即時",
      dftIntroC3d: "邊打邊看符合結果。",
    },
  },
};
