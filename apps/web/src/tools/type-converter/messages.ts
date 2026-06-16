import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "type-converter": {
        title: "Data Type Converter",
        description: "Convert values between string, number, boolean, and date.",
      },
    },
    ToolUI: { inputValue: "Value", targetType: "Target type" },
  },
  "zh-TW": {
    Tools: {
      "type-converter": {
        title: "資料型別轉換器",
        description: "在字串、數字、布林、日期之間轉換值。",
      },
    },
    ToolUI: { inputValue: "值", targetType: "目標型別" },
  },
};
