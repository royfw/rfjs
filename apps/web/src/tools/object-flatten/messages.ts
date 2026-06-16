import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "object-flatten": {
        title: "Object Flatten / Unflatten",
        description: "Flatten nested objects to dot-path keys and back.",
      },
    },
    ToolUI: { jsonInput: "JSON" },
  },
  "zh-TW": {
    Tools: {
      "object-flatten": { title: "物件壓平 / 還原", description: "把巢狀物件壓平成點路徑鍵,並可還原。" },
    },
    ToolUI: { jsonInput: "JSON" },
  },
};
