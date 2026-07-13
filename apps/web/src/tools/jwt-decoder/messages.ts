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
      jwtIntroTagline: "Paste a JWT → header + payload + live expiry",
      jwtIntroC1t: "① Paste",
      jwtIntroC1d: "A JWT string.",
      jwtIntroC2t: "② Decode",
      jwtIntroC2d: "@rfjs/jwt splits and decodes the header + payload (no verification).",
      jwtIntroC3t: "③ Expiry",
      jwtIntroC3d: "A live expiry chip ticks against exp.",
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
      jwtIntroTagline: "貼一個 JWT → header + payload + 即時有效期",
      jwtIntroC1t: "① 貼上",
      jwtIntroC1d: "JWT 字串。",
      jwtIntroC2t: "② 解碼",
      jwtIntroC2d: "@rfjs/jwt 拆解並解碼 header + payload(不驗簽)。",
      jwtIntroC3t: "③ 有效期",
      jwtIntroC3d: "徽章依 exp 即時跳動。",
    },
  },
};
