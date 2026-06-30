import type { FlowDoc } from "./schema";

/** 內建範例:請假申請 → 判斷 → 通知 / 自動核准。 */
export const sample: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 120 } },
    { id: "form-1", type: "form", position: { x: 150, y: 100 }, config: { version: 1, fields: [{ key: "days", label: "Days", component: "Number", dataType: "number" }] } },
    { id: "cond-1", type: "condition", position: { x: 380, y: 110 } },
    { id: "act-1", type: "action", position: { x: 600, y: 40 }, config: { kind: "notify", params: {} } },
    { id: "act-2", type: "action", position: { x: 600, y: 200 }, config: { kind: "db.update", params: {} } },
    { id: "end", type: "end", position: { x: 820, y: 120 } },
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
