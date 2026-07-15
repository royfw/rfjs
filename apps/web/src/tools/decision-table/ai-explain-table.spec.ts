import { describe, expect, it } from "vitest";

import { buildTableAskPrompt, buildTableExplainPrompt } from "./ai-explain-table";

const CTX = { tableJson: '{"rules":[{"id":"r1"}]}', locale: "zh-TW" };

describe("table explain/ask prompts", () => {
  it("system 含表格 JSON、locale、純文字指示;explain user 提到 explain", () => {
    const p = buildTableExplainPrompt(CTX);
    expect(p.system).toContain(CTX.tableJson);
    expect(p.system).toContain("zh-TW");
    expect(p.system.toLowerCase()).toContain("plain text");
    expect(p.user).toMatch(/explain/i);
  });
  it("ask 的 user 為問題原文", () => {
    const p = buildTableAskPrompt(CTX, "r1 什麼時候命中?");
    expect(p.user).toBe("r1 什麼時候命中?");
    expect(p.system).toContain(CTX.tableJson);
  });
});
