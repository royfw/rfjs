import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "jwt-decoder": {
        title: "JWT Decoder",
        description: "Decode a JWT's header and payload, with a live expiry status.",
      },
    },
    ToolUI: {
      token: "JWT",
      header: "Header",
      payload: "Payload",
      signature: "Signature",
      expiresIn: "expires in {duration}",
      expired: "expired",
      noExpiry: "no expiry",
    },
  },
  "zh-TW": {
    Tools: {
      "jwt-decoder": { title: "JWT 解碼器", description: "解碼 JWT 的 header 與 payload，並顯示即時有效期狀態。" },
    },
    ToolUI: {
      token: "JWT",
      header: "Header",
      payload: "Payload",
      signature: "簽章",
      expiresIn: "{duration}後過期",
      expired: "已過期",
      noExpiry: "無有效期",
    },
  },
};
