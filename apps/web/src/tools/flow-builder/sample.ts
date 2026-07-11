import type { FlowDoc } from "@rfjs/flow-core";

/** 內建範例:請假申請 → 判斷 → 通知 / 自動核准。
 * 座標刻意讓主軸(start→form→cond→end)的把手中心對齊 y=150:
 * start/cond/end 高 46(中心 +23)、form/action 高 62(中心 +31),
 * 節點寬 150、水平間距 60 —— 主線筆直、節點不相黏也不鬆散。 */
export const sample: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 40, y: 127 } },
    { id: "form-1", type: "form", position: { x: 250, y: 119 }, config: { version: 1, fields: [{ key: "days", label: "Days", component: "Number", dataType: "number" }] } },
    { id: "cond-1", type: "condition", position: { x: 460, y: 127 } },
    { id: "act-1", type: "action", position: { x: 670, y: 29 }, config: { kind: "notify", params: {} } },
    { id: "act-2", type: "action", position: { x: 670, y: 209 }, config: { kind: "db.update", params: {} } },
    { id: "end", type: "end", position: { x: 880, y: 127 } },
  ],
  edges: [
    { id: "e1", source: "start", target: "form-1" },
    { id: "e2", source: "form-1", target: "cond-1", trigger: "onSubmit" },
    { id: "e3", source: "cond-1", target: "act-1", sourceHandle: "yes", label: "yes" },
    { id: "e4", source: "cond-1", target: "act-2", sourceHandle: "no", label: "no" },
    { id: "e5", source: "act-1", target: "end" },
    { id: "e6", source: "act-2", target: "end" },
  ],
};
