import type { FlowDoc, FlowEdge, FlowNodeType } from "./schema";

export interface ProjectOptions {
  /** 要保留的「中間節點」型別;start/end 永遠保留,不受此參數影響。 */
  keep: FlowNodeType[];
}

/** 縮線新邊 id:label 併入以保住 yes/no 平行邊的唯一性。 */
function contractedId(source: string, target: string, label?: string): string {
  return label ? `proj-${source}-${target}-${label}` : `proj-${source}-${target}`;
}

/** 節點型別過濾投影:移除不在 keep 集合的中間節點,其入邊×出邊自動「縮線」接起。 */
export function projectFlow(doc: FlowDoc, options: ProjectOptions): FlowDoc {
  const keep = new Set<FlowNodeType>(["start", "end", ...options.keep]);
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  const isKept = (id: string): boolean => {
    const n = nodeById.get(id);
    return n !== undefined && keep.has(n.type);
  };

  const outgoing = new Map<string, FlowEdge[]>();
  for (const e of doc.edges) {
    const list = outgoing.get(e.source);
    if (list) list.push(e);
    else outgoing.set(e.source, [e]);
  }

  const edges: FlowEdge[] = [];
  const seen = new Set<string>(); // (source, target, label) 去重

  // 只從「保留節點的出邊」出發,沿被移除節點 DFS,收所有可達的保留節點。
  for (const first of doc.edges) {
    if (!isKept(first.source)) continue;
    const stack: FlowEdge[] = [first];
    const visited = new Set<string>(); // 防被移除節點間的環
    while (stack.length > 0) {
      const edge = stack.pop()!;
      if (isKept(edge.target)) {
        if (first.source === edge.target) continue; // 自環丟棄
        const key = `${first.source}|${edge.target}|${first.label ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (edge === first) {
          edges.push({ ...first }); // 未經縮線:原樣保留(含 trigger/condition)
        } else {
          edges.push({
            id: contractedId(first.source, edge.target, first.label),
            source: first.source,
            target: edge.target,
            ...(first.sourceHandle !== undefined ? { sourceHandle: first.sourceHandle } : {}),
            ...(first.label !== undefined ? { label: first.label } : {}),
          });
        }
      } else if (!visited.has(edge.target)) {
        visited.add(edge.target);
        for (const next of outgoing.get(edge.target) ?? []) stack.push(next);
      }
    }
  }

  return {
    version: 1,
    nodes: doc.nodes.filter((n) => keep.has(n.type)).map((n) => ({ ...n })),
    edges,
  };
}
