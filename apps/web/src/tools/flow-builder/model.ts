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
    data: { type: n.type, config: n.config } satisfies FlowNodeData,
  }));
  const edges: RFEdge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
  }));
  return { nodes, edges };
}

export function toFlowDoc(nodes: RFNode[], edges: RFEdge[]): FlowDoc {
  return {
    version: 1,
    nodes: nodes.map((n) => {
      const data = n.data as FlowNodeData;
      return { id: n.id, type: data.type, position: n.position, config: data.config };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === "string" ? e.label : undefined,
    })),
  };
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
