import { describe, expect, it } from "vitest";

import { escapeXml, makeIdMapper } from "./bpmn";

describe("escapeXml", () => {
  it("escapes the five xml special characters", () => {
    expect(escapeXml(`a<b>&"c"'d'`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;&apos;d&apos;");
  });
});

describe("makeIdMapper", () => {
  it("prefixes and keeps ncname-safe chars", () => {
    const map = makeIdMapper("Node");
    expect(map("form-1")).toBe("Node_form-1");
  });

  it("is stable for the same raw id", () => {
    const map = makeIdMapper("Node");
    expect(map("a")).toBe(map("a"));
  });

  it("sanitizes illegal chars and resolves collisions deterministically", () => {
    const map = makeIdMapper("Node");
    expect(map("a b")).toBe("Node_a_b");
    expect(map("a_b")).toBe("Node_a_b_2"); // sanitize 後撞名 → 附序號
    expect(map("a b")).toBe("Node_a_b"); // 既有對映不受影響
  });
});
