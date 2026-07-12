import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "object-flatten": {
        title: "Object Flatten / Unflatten",
        description: "Flatten nested objects to dot-path keys and back.",
      },
    },
    ToolUI: {
      jsonInput: "JSON",
      oflIntroTagline: "Nested object ⇄ dot-path keys",
      oflIntroC1t: "① Flatten",
      oflIntroC1d: "@rfjs/object-utils turns nested objects into a.b.c keys.",
      oflIntroC2t: "② Unflatten",
      oflIntroC2d: "And back again, round-trip.",
    },
  },
  "zh-TW": {
    Tools: {
      "object-flatten": { title: "物件壓平 / 還原", description: "把巢狀物件壓平成點路徑鍵,並可還原。" },
    },
    ToolUI: {
      jsonInput: "JSON",
      oflIntroTagline: "巢狀物件 ⇄ 點路徑鍵",
      oflIntroC1t: "① 壓平",
      oflIntroC1d: "@rfjs/object-utils 把巢狀物件變成 a.b.c 鍵。",
      oflIntroC2t: "② 還原",
      oflIntroC2d: "也能反向還原,來回往返。",
    },
  },
};
