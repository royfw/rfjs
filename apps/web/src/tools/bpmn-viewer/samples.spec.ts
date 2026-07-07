import { describe, expect, it } from "vitest";

import { SAMPLES, DEFAULT_SAMPLE_ID, getSample } from "./samples";

describe("bpmn samples", () => {
  it("ships at least two samples, each a valid-looking BPMN diagram", () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(2);
    for (const s of SAMPLES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.xml).toContain("<bpmn:definitions");
      expect(s.xml).toContain("bpmndi:BPMNDiagram"); // 需有 DI 才畫得出版面
    }
  });

  it("has unique ids and a resolvable default", () => {
    const ids = SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getSample(DEFAULT_SAMPLE_ID)).toBeDefined();
    expect(getSample("nope")).toBeUndefined();
  });
});
