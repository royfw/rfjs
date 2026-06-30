import { describe, expect, it } from "vitest";

import { validateBpmnFile, MAX_BPMN_BYTES } from "./file-input";

describe("validateBpmnFile", () => {
  it("accepts .bpmn and .xml within the size limit", () => {
    expect(validateBpmnFile({ name: "flow.bpmn", size: 100 })).toEqual({ ok: true });
    expect(validateBpmnFile({ name: "flow.xml", size: 100 })).toEqual({ ok: true });
    expect(validateBpmnFile({ name: "FLOW.BPMN", size: 100 })).toEqual({ ok: true }); // 大小寫不敏感
  });

  it("rejects disallowed extensions", () => {
    expect(validateBpmnFile({ name: "flow.pdf", size: 100 })).toEqual({ ok: false, reason: "extension" });
    expect(validateBpmnFile({ name: "noext", size: 100 })).toEqual({ ok: false, reason: "extension" });
  });

  it("rejects empty and oversized files", () => {
    expect(validateBpmnFile({ name: "flow.bpmn", size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(validateBpmnFile({ name: "flow.bpmn", size: MAX_BPMN_BYTES + 1 })).toEqual({ ok: false, reason: "size" });
    expect(validateBpmnFile({ name: "flow.bpmn", size: MAX_BPMN_BYTES })).toEqual({ ok: true });
  });
});
