import { describe, expect, it } from "vitest";

import { buildCheckPrompt, parseCheckResponse } from "./ai-check";

describe("buildCheckPrompt", () => {
  it("embeds the table json and the locale instruction", () => {
    const p = buildCheckPrompt('{"version":1}', "zh-TW");
    expect(p.user).toContain('{"version":1}');
    expect(p.system).toContain("zh-TW");
    expect(p.system).toContain("gap");
  });
});

describe("parseCheckResponse (gate + hallucination filter)", () => {
  const VALID = ["r1", "r2"];

  it("accepts a valid findings payload and filters unknown rule ids", () => {
    const raw = JSON.stringify({
      findings: [
        { kind: "overlap", ruleIds: ["r1", "ghost"], message: "r1 overlaps" },
        { kind: "note", ruleIds: [], message: "looks fine" },
      ],
    });
    const out = parseCheckResponse(raw, VALID);
    expect(out).toHaveLength(2);
    expect(out[0]!.ruleIds).toEqual(["r1"]); // ghost 被濾掉
  });

  it("rejects non-json and wrong shapes", () => {
    expect(() => parseCheckResponse("nope", VALID)).toThrow();
    expect(() => parseCheckResponse('{"findings":[{"kind":"bogus","ruleIds":[],"message":"x"}]}', VALID)).toThrow();
  });
});
