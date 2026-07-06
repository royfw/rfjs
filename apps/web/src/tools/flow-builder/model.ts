import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

import type { FlowDoc, FlowNodeType } from "./schema";

export interface FlowNodeData {
  type: FlowNodeType;
  config?: unknown;
  label?: string;
  [key: string]: unknown;
}

/** 各節點型別的預設 config(內嵌既有工具 JSON 的初值)。 */
export function defaultConfig(type: FlowNodeType): unknown {
  switch (type) {
    case "form":
      return { version: 1, fields: [] }; // FormConfig
    case "action":
      return { kind: "notify", params: {} };
    default:
      return undefined; // condition 由 inspector 以 emptyGroup 延遲種子;start/end 無 config
  }
}

export function toReactFlow(doc: FlowDoc): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = doc.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      type: n.type,
      config: n.config,
      ...(n.inputs !== undefined ? { inputs: n.inputs } : {}),
      ...(n.outputCollection !== undefined ? { outputCollection: n.outputCollection } : {}),
    } satisfies FlowNodeData,
  }));
  const edges: RFEdge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
    type: "smoothstep", // 顯示用:直角折線(不存回 FlowDoc)
    ...(e.trigger !== undefined || e.condition !== undefined
      ? {
          data: {
            ...(e.trigger !== undefined ? { trigger: e.trigger } : {}),
            ...(e.condition !== undefined ? { condition: e.condition } : {}),
          },
        }
      : {}),
  }));
  return { nodes, edges };
}

export function toFlowDoc(nodes: RFNode[], edges: RFEdge[]): FlowDoc {
  return {
    version: 1,
    nodes: nodes.map((n) => {
      const data = n.data as FlowNodeData;
      return {
        id: n.id,
        type: data.type,
        position: n.position,
        config: data.config,
        ...(data.inputs !== undefined ? { inputs: data.inputs as string[] } : {}),
        ...(data.outputCollection !== undefined ? { outputCollection: data.outputCollection as boolean } : {}),
      };
    }),
    edges: edges.map((e) => {
      const eData = e.data as { trigger?: string; condition?: unknown } | undefined;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
        label: typeof e.label === "string" ? e.label : undefined,
        ...(eData?.trigger !== undefined ? { trigger: eData.trigger } : {}),
        ...(eData?.condition !== undefined ? { condition: eData.condition } : {}),
      };
    }),
  };
}

// 節點的近似佔位(含間距),用於找不重疊的空位。
const SLOT_W = 210;
const SLOT_H = 120;

/** 回傳一個不與既有節點重疊的擺放位置(由左上往右、再往下掃)。 */
export function findFreePosition(existing: { x: number; y: number }[]): { x: number; y: number } {
  const X0 = 60;
  const Y0 = 60;
  const COLS = 4;
  const taken = (x: number, y: number) =>
    existing.some((p) => Math.abs(p.x - x) < SLOT_W && Math.abs(p.y - y) < SLOT_H);
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = X0 + col * SLOT_W;
      const y = Y0 + row * SLOT_H;
      if (!taken(x, y)) return { x, y };
    }
  }
  return { x: X0, y: Y0 };
}

let nodeSeq = 0;
export function newNode(type: FlowNodeType, position: { x: number; y: number }): RFNode {
  nodeSeq += 1;
  return {
    id: `${type}-${nodeSeq}`,
    type,
    position,
    data: { type, config: defaultConfig(type) } satisfies FlowNodeData,
  };
}
