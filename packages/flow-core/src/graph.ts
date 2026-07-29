import type { FlowDoc, FlowEdge, FlowNode } from "./schema";

export interface TraversalOptions {
  /** 是否把起點節點本身納入結果(仍受 filter 約束)。預設 false。 */
  includeSelf?: boolean;
  /**
   * 收集語意:決定哪些節點「進入結果」,而非剪枝。
   * 被 filter 排除的節點仍會被展開(其出/入邊照樣走)。
   */
  filter?: (node: FlowNode) => boolean;
  /**
   * 走訪語意:決定是否沿某條邊前進(例如排除 trigger:'timeout' 邊)。
   * 預設走所有邊。
   */
  follow?: (edge: FlowEdge) => boolean;
}

/** doc.nodes 建成 id → node 索引(取代 O(n) 的 doc.nodes.find)。後出現的同 id 會覆蓋前者。 */
export function nodeById(doc: FlowDoc): Map<string, FlowNode> {
  const map = new Map<string, FlowNode>();
  for (const n of doc.nodes) map.set(n.id, n);
  return map;
}

/** 依 source 分組的出邊索引;每組維持 doc.edges 的原始陣列順序。 */
export function outgoingEdges(doc: FlowDoc): Map<string, FlowEdge[]> {
  const map = new Map<string, FlowEdge[]>();
  for (const e of doc.edges) {
    const list = map.get(e.source);
    if (list) list.push(e);
    else map.set(e.source, [e]);
  }
  return map;
}

/** 依 target 分組的入邊索引(反向走訪用);每組維持 doc.edges 的原始陣列順序。 */
function incomingEdges(doc: FlowDoc): Map<string, FlowEdge[]> {
  const map = new Map<string, FlowEdge[]>();
  for (const e of doc.edges) {
    const list = map.get(e.target);
    if (list) list.push(e);
    else map.set(e.target, [e]);
  }
  return map;
}

/**
 * 廣度優先走訪的共用核心。
 * - 結果順序 = BFS 造訪順序;同一節點的鄰邊依 doc.edges 的陣列順序展開(故對同一 doc 結果穩定)。
 * - visited 集合切斷環(back edge),每個節點最多造訪一次,不會無限迴圈。
 * - 邊指向不存在的節點(schema 不強制參照完整性)時跳過,不視為可達。
 * - 未知起點 → 回 [](不丟例外)。
 */
function traverse(
  doc: FlowDoc,
  startId: string,
  direction: "forward" | "reverse",
  options: TraversalOptions,
): FlowNode[] {
  const index = nodeById(doc);
  const startNode = index.get(startId);
  if (!startNode) return [];

  const { includeSelf = false, filter, follow } = options;
  const adjacency = direction === "forward" ? outgoingEdges(doc) : incomingEdges(doc);
  const nextIdOf = (e: FlowEdge): string => (direction === "forward" ? e.target : e.source);

  const result: FlowNode[] = [];
  const collect = (node: FlowNode): void => {
    if (!filter || filter(node)) result.push(node);
  };
  if (includeSelf) collect(startNode);

  const visited = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    for (const edge of adjacency.get(currentId) ?? []) {
      if (follow && !follow(edge)) continue;
      const nextId = nextIdOf(edge);
      if (visited.has(nextId)) continue;
      const node = index.get(nextId);
      if (!node) continue; // dangling 端點:跳過,不算可達
      visited.add(nextId);
      queue.push(nextId);
      collect(node);
    }
  }
  return result;
}

/**
 * 從 fromId 沿邊「往前」可達的節點(預設不含 fromId 本身);環由 visited 集合切斷。
 * 未知 fromId → []。
 */
export function reachableNodes(doc: FlowDoc, fromId: string, options: TraversalOptions = {}): FlowNode[] {
  return traverse(doc, fromId, "forward", options);
}

/**
 * 反向:能「到達」toId 的節點(預設不含 toId 本身),用來回溯「為何走到這一步」。
 * 未知 toId → []。
 */
export function ancestorNodes(doc: FlowDoc, toId: string, options: TraversalOptions = {}): FlowNode[] {
  return traverse(doc, toId, "reverse", options);
}
