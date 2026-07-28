import { describe, expect, it } from "vitest";
import type { FlowDoc } from "./schema";
import { startFlow, advance, FlowError, type FlowErrorKind } from "./runtime";

/** 保證「有丟 + kind 正確」—— 先 toThrow 確保真的丟(不丟則 fail),再取 kind 斷言。 */
function expectFlowError(fn: () => unknown, kind: FlowErrorKind): void {
  expect(fn).toThrow(FlowError);
  try {
    fn();
  } catch (e) {
    expect((e as FlowError).kind).toBe(kind);
  }
}

// 請假流:start → form → condition(yes/no)→ action → end;approver form 另有 timeout 邊 → esc(condition)
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 0, y: 0 } },
    { id: "cond1", type: "condition", position: { x: 0, y: 0 } },
    { id: "act1", type: "action", position: { x: 0, y: 0 } },
    { id: "act2", type: "action", position: { x: 0, y: 0 } },
    { id: "esc", type: "condition", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e0", source: "start", target: "form1" },
    { id: "e1", source: "form1", target: "cond1", trigger: "onSubmit" },
    { id: "et", source: "form1", target: "esc", trigger: "timeout" },
    { id: "e2", source: "cond1", target: "act1", sourceHandle: "yes" },
    { id: "e3", source: "cond1", target: "act2", sourceHandle: "no" },
    { id: "e4", source: "act1", target: "end" },
    { id: "e5", source: "act2", target: "end" },
    { id: "e6", source: "esc", target: "end", sourceHandle: "auto" },
  ],
};

describe("startFlow", () => {
  it("進 start、自動推進到第一個 block 節點(form)", () => {
    const s = startFlow(doc);
    expect(s).toMatchObject({ at: "form1", status: "running", awaiting: "submit" });
    expect(s.context).toEqual({});
  });
  it("start 無出邊 → FlowError no-path(spec §5)", () => {
    const bad: FlowDoc = { version: 1, nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 } }], edges: [] };
    expectFlowError(() => startFlow(bad), "no-path");
  });
  it("無 start 節點 → FlowError no-path", () => {
    const bad: FlowDoc = { version: 1, nodes: [{ id: "end", type: "end", position: { x: 0, y: 0 } }], edges: [] };
    expectFlowError(() => startFlow(bad), "no-path");
  });
});

describe("advance —— 正常路徑", () => {
  it("submit 併資料、推進到 condition 並列出 options", () => {
    let s = startFlow(doc);
    s = advance(doc, s, { type: "submit", data: { days: 5 } });
    expect(s).toMatchObject({ at: "cond1", awaiting: "decision" });
    expect(s.options).toEqual(["yes", "no"]);
    expect(s.context).toEqual({ days: 5 });
  });
  it("decide 'no' → act2", () => {
    const s = advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: { days: 5 } }, { type: "decide", handle: "no" });
    expect(s).toMatchObject({ at: "act2", awaiting: "action" });
  });
  it("decide 'yes' → act1(兩條分支都測)", () => {
    const s = advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: { days: 2 } }, { type: "decide", handle: "yes" });
    expect(s).toMatchObject({ at: "act1", awaiting: "action" });
  });
  it("decide 回傳的 context 不與輸入 state 共享物件", () => {
    const input = { days: 5 };
    const s = advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: input }, { type: "decide", handle: "no" });
    expect(s.context).not.toBe(input);
    expect(s.context).toEqual(input);
  });
  it("complete 併 result、走到 end done", () => {
    const s = advance(doc, { at: "act2", status: "running", awaiting: "action", context: { days: 5 } }, { type: "complete", result: { ticket: "T-1" } });
    expect(s).toMatchObject({ at: "end", status: "done", awaiting: null });
    expect(s.context).toEqual({ days: 5, ticket: "T-1" });
  });
});

describe("advance —— action fail", () => {
  it("fail → status failed、__error 存入 context", () => {
    const s = advance(doc, { at: "act1", status: "running", awaiting: "action", context: {} }, { type: "fail", error: "boom" });
    expect(s).toMatchObject({ at: "act1", status: "failed", awaiting: null });
    expect(s.context.__error).toBe("boom");
  });
});

describe("advance —— timeout(含條件式)", () => {
  it("form 節點 timeout 走 trigger:timeout 邊,落在 condition(條件式 timeout)", () => {
    const s = advance(doc, { at: "form1", status: "running", awaiting: "submit", context: {} }, { type: "timeout" });
    expect(s).toMatchObject({ at: "esc", awaiting: "decision" });
    expect(s.options).toEqual(["auto"]);
  });
  it("節點無 timeout 邊 → FlowError no-edge", () => {
    // act1 無 timeout 邊
    expectFlowError(
      () => advance(doc, { at: "act1", status: "running", awaiting: "action", context: {} }, { type: "timeout" }),
      "no-edge",
    );
  });
});

// #265:核准步驟(condition)逾時逃逸(approval-escalation)。
// start → capprove(condition: yes/no + timeout→esc2)→ act1/act2 → end;esc2 為逃逸 condition。
const escDoc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "capprove", type: "condition", position: { x: 0, y: 0 } },
    { id: "act1", type: "action", position: { x: 0, y: 0 } },
    { id: "act2", type: "action", position: { x: 0, y: 0 } },
    { id: "esc2", type: "condition", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e0", source: "start", target: "capprove" },
    { id: "e1", source: "capprove", target: "act1", sourceHandle: "yes" },
    { id: "e2", source: "capprove", target: "act2", sourceHandle: "no" },
    // 逃逸邊帶 sourceHandle,用以證明 Q2 過濾:它不該出現在 options。
    { id: "et", source: "capprove", target: "esc2", sourceHandle: "escalate", trigger: "timeout" },
    { id: "e3", source: "esc2", target: "end", sourceHandle: "auto" },
    { id: "e4", source: "act1", target: "end" },
    { id: "e5", source: "act2", target: "end" },
  ],
};

describe("advance —— condition 節點 timeout(approval-escalation, #265)", () => {
  it("落在 condition 時 options 排除 trigger:'timeout' 邊(Q2)", () => {
    const s = startFlow(escDoc);
    expect(s).toMatchObject({ at: "capprove", awaiting: "decision" });
    expect(s.options).toEqual(["yes", "no"]);
    expect(s.options).not.toContain("escalate");
  });
  it("condition 節點 timeout → 沿 trigger:'timeout' 邊落在逃逸目標", () => {
    const start = startFlow(escDoc);
    const s = advance(escDoc, start, { type: "timeout" });
    expect(s).toMatchObject({ at: "esc2", awaiting: "decision" });
  });
  it("逃逸目標仍是 condition → 新 state 列出其 options", () => {
    const s = advance(
      escDoc,
      { at: "capprove", status: "running", awaiting: "decision", context: { days: 3 } },
      { type: "timeout" },
    );
    expect(s.at).toBe("esc2");
    expect(s.options).toEqual(["auto"]);
    // context 透傳但不共享物件(與 form/action timeout 一致,不 merge 新資料)。
    expect(s.context).toEqual({ days: 3 });
  });
  it("condition 無 timeout 邊 → FlowError no-edge(#265 向後相容註記:原為 wrong-event)", () => {
    // 原 doc 的 cond1 無 timeout 邊
    expectFlowError(
      () => advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: {} }, { type: "timeout" }),
      "no-edge",
    );
  });
});

describe("advance —— 錯誤", () => {
  it("wrong-event:awaiting decision 卻餵 submit", () => {
    expectFlowError(
      () => advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: {} }, { type: "submit", data: {} }),
      "wrong-event",
    );
  });
  it("unknown-handle:decide 給不存在的 handle", () => {
    expectFlowError(
      () => advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: {} }, { type: "decide", handle: "maybe" }),
      "unknown-handle",
    );
  });
  it("已結束的流程再 advance → wrong-event", () => {
    expectFlowError(
      () => advance(doc, { at: "end", status: "done", awaiting: null, context: {} }, { type: "submit", data: {} }),
      "wrong-event",
    );
  });
});
