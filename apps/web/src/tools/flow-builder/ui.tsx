"use client";

import * as React from "react";
import {
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslations } from "next-intl";

import { Button } from "@rfjs/web-ui/components/button";
import type { FilterTreeLabels } from "@rfjs/filter-builder-ui";

import { nodeTypes } from "./nodes";
import { AdaptiveEdge } from "./edges";
import { Inspector } from "./inspector";
import { NodeSheet } from "./node-sheet";
import { findFreePosition, newNode, toFlowDoc, toReactFlow, type FlowNodeData } from "./model";
import { flowToJson } from "./schema";
import { sample } from "./sample";

// 直接觀察 <html> 的 class(next-themes attribute="class"):比 useTheme 的
// resolvedTheme 可靠 —— 後者在 hydration 時序下可能停留在 undefined,導致
// ReactFlow colorMode 卡在 light(Controls 等內建 UI 變白)。
const edgeTypes = { adaptive: AdaptiveEdge };

function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

function FlowBuilderInner() {
  const t = useTranslations("ToolUI");
  const isDark = useIsDark();
  const seeded = React.useMemo(() => toReactFlow(sample), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filterLabels: FilterTreeLabels = {
    logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
    addCondition: t("flowFilterAddCondition"),
    addGroup: t("flowFilterAddGroup"),
    removeGroup: t("flowFilterRemoveGroup"),
    removeCondition: t("flowFilterRemoveCondition"),
    elemMatch: t("flowFilterElemMatch"),
  };

  const onConnect = React.useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const addNode = (type: Parameters<typeof newNode>[0]) => {
    // 找一個不與既有節點重疊的空位再放。
    setNodes((ns) => [...ns, newNode(type, findFreePosition(ns.map((n) => n.position)))]);
  };

  const onConfigChange = React.useCallback((id: string, config: unknown) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as FlowNodeData), config } } : n)));
  }, [setNodes]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const json = React.useMemo(() => flowToJson(toFlowDoc(nodes, edges)), [nodes, edges]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("flowEyebrow")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => addNode("form")}>{t("flowAddForm")}</Button>
        <Button size="sm" variant="outline" onClick={() => addNode("condition")}>{t("flowAddCondition")}</Button>
        <Button size="sm" variant="outline" onClick={() => addNode("action")}>{t("flowAddAction")}</Button>
        <Button size="sm" variant="outline" onClick={() => addNode("end")}>{t("flowAddEnd")}</Button>
      </div>

      <div className="h-[560px] w-full rounded-md border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_e: React.MouseEvent, n: Node) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{ type: "adaptive", markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 } }}
          snapToGrid
          snapGrid={[10, 10]}
          colorMode={isDark ? "dark" : "light"}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("flowJson")}</p>
        <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed">{json}</pre>
      </div>

      {selected ? (
        <NodeSheet title={t("flowInspector")} closeLabel={t("flowClose")} onClose={() => setSelectedId(null)}>
          <Inspector
            key={selected.id}
            node={{ id: selected.id, data: selected.data as FlowNodeData }}
            onConfigChange={onConfigChange}
            labels={{
              filter: filterLabels,
              actionKinds: ["notify", "db.update", "http"],
              selectHint: t("flowSelectHint"),
              noSettings: t("flowNoSettings"),
              actionKindLabel: t("flowActionKind"),
            }}
          />
        </NodeSheet>
      ) : null}
    </div>
  );
}

export function FlowBuilderTool() {
  // ReactFlowProvider 提供 Handle / hooks 的 context。
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}
