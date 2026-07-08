import { describe, expect, it } from "vitest";

import { buildFormAskPrompt, buildFormExplainPrompt } from "./ai-explain-form";

const CTX = { configJson: '{"version":1,"fields":[]}', locale: "zh-TW" };

describe("form explain/ask prompts", () => {
  it("system 含表單 config JSON、locale、純文字指示;explain user 提到 explain", () => {
    const p = buildFormExplainPrompt(CTX);
    expect(p.system).toContain(CTX.configJson);
    expect(p.system).toContain("zh-TW");
    expect(p.system.toLowerCase()).toContain("plain text");
    expect(p.user).toMatch(/explain/i);
  });
  it("ask 的 user 為問題原文", () => {
    const p = buildFormAskPrompt(CTX, "這個表單收集什麼?");
    expect(p.user).toBe("這個表單收集什麼?");
    expect(p.system).toContain(CTX.configJson);
  });
});
