import type { FlowDoc, FlowEdge, FlowNode } from "./schema";

export type FlowAwaiting = "submit" | "decision" | "action" | null;
export type FlowStatus = "running" | "done" | "failed";

export interface FlowState {
  at: string;
  status: FlowStatus;
  awaiting: FlowAwaiting;
  options?: string[];
  context: Record<string, unknown>;
}

export type FlowEvent =
  | { type: "submit"; data: Record<string, unknown> }
  | { type: "decide"; handle: string }
  | { type: "complete"; result?: Record<string, unknown> }
  | { type: "fail"; error?: unknown }
  | { type: "timeout" };

export type FlowErrorKind = "wrong-event" | "no-edge" | "unknown-handle" | "no-path";

export class FlowError extends Error {
  constructor(
    public readonly kind: FlowErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "FlowError";
  }
}

const nodeById = (doc: FlowDoc, id: string): FlowNode => {
  const n = doc.nodes.find((x) => x.id === id);
  if (!n) throw new FlowError("no-path", `node not found: ${id}`);
  return n;
};

const outEdges = (doc: FlowDoc, id: string): FlowEdge[] => doc.edges.filter((e) => e.source === id);

/** 依節點型別給 awaiting;start/end 為 null。 */
function awaitingFor(type: FlowNode["type"]): FlowAwaiting {
  if (type === "form") return "submit";
  if (type === "condition") return "decision";
  if (type === "action") return "action";
  return null;
}

/** 到達 nodeId,計算落地狀態。 */
function land(doc: FlowDoc, nodeId: string, context: Record<string, unknown>): FlowState {
  const node = nodeById(doc, nodeId);
  if (node.type === "end") return { at: nodeId, status: "done", awaiting: null, context };
  const state: FlowState = { at: nodeId, status: "running", awaiting: awaitingFor(node.type), context };
  if (node.type === "condition") {
    state.options = outEdges(doc, nodeId)
      .map((e) => e.sourceHandle)
      .filter((h): h is string => typeof h === "string");
  }
  return state;
}

/** 唯一「正常」(非 timeout)出邊的目標。 */
function normalTarget(doc: FlowDoc, id: string): string {
  const edges = outEdges(doc, id).filter((e) => e.trigger !== "timeout");
  if (edges.length !== 1) {
    throw new FlowError("no-edge", `expected exactly one non-timeout out-edge from ${id}, got ${edges.length}`);
  }
  return edges[0].target;
}

function timeoutTarget(doc: FlowDoc, id: string): string {
  const edge = outEdges(doc, id).find((e) => e.trigger === "timeout");
  if (!edge) throw new FlowError("no-edge", `no timeout out-edge from ${id}`);
  return edge.target;
}

/** 進入流程:定位 start,沿其正常出邊推進到第一個 block 節點。
 * 依 spec §5:start 無出邊 → no-path(不是 no-edge —— no-edge 保留給一般節點缺出邊)。 */
export function startFlow(doc: FlowDoc): FlowState {
  const start = doc.nodes.find((n) => n.type === "start");
  if (!start) throw new FlowError("no-path", "no start node");
  if (outEdges(doc, start.id).filter((e) => e.trigger !== "timeout").length === 0) {
    throw new FlowError("no-path", "start node has no out-edge");
  }
  return land(doc, normalTarget(doc, start.id), {});
}

/** 走一步:事件須配得上目前節點,否則丟 FlowError。 */
export function advance(doc: FlowDoc, state: FlowState, event: FlowEvent): FlowState {
  if (state.status !== "running") throw new FlowError("wrong-event", `flow is ${state.status}`);
  const node = nodeById(doc, state.at);
  const ctx = state.context;

  switch (event.type) {
    case "submit":
      if (node.type !== "form") throw new FlowError("wrong-event", `submit at ${node.type}`);
      return land(doc, normalTarget(doc, node.id), { ...ctx, ...event.data });
    case "complete":
      if (node.type !== "action") throw new FlowError("wrong-event", `complete at ${node.type}`);
      return land(doc, normalTarget(doc, node.id), { ...ctx, ...(event.result ?? {}) });
    case "fail":
      if (node.type !== "action") throw new FlowError("wrong-event", `fail at ${node.type}`);
      return { at: node.id, status: "failed", awaiting: null, context: { ...ctx, __error: event.error } };
    case "decide": {
      if (node.type !== "condition") throw new FlowError("wrong-event", `decide at ${node.type}`);
      const edge = outEdges(doc, node.id).find((e) => e.sourceHandle === event.handle);
      if (!edge) throw new FlowError("unknown-handle", `no edge for handle ${event.handle} at ${node.id}`);
      // 回傳新 state 的 context 一律不與輸入 state 共享物件(消費端可安全同時持有新舊 state)。
      return land(doc, edge.target, { ...ctx });
    }
    case "timeout":
      if (node.type !== "form" && node.type !== "action") throw new FlowError("wrong-event", `timeout at ${node.type}`);
      return land(doc, timeoutTarget(doc, node.id), { ...ctx });
  }
}
