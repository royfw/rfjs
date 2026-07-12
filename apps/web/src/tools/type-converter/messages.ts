import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "type-converter": {
        title: "Data Type Converter",
        description: "Convert values between string, number, boolean, and date.",
      },
    },
    ToolUI: {
      inputValue: "Value",
      targetType: "Target type",
      tcvIntroTagline: "Convert a value between string / number / boolean / date",
      tcvIntroC1t: "① Pick",
      tcvIntroC1d: "A source value and a target type.",
      tcvIntroC2t: "② Convert",
      tcvIntroC2d: "@rfjs/data-transform coerces it, showing the result live.",
    },
  },
  "zh-TW": {
    Tools: {
      "type-converter": {
        title: "資料型別轉換器",
        description: "在字串、數字、布林、日期之間轉換值。",
      },
    },
    ToolUI: {
      inputValue: "值",
      targetType: "目標型別",
      tcvIntroTagline: "在 string / number / boolean / date 間轉換值",
      tcvIntroC1t: "① 選擇",
      tcvIntroC1d: "來源值與目標型別。",
      tcvIntroC2t: "② 轉換",
      tcvIntroC2d: "@rfjs/data-transform 轉換並即時顯示結果。",
    },
  },
};
