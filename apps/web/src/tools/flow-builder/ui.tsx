"use client";

import * as React from "react";
import {
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
import { Inspector } from "./inspector";
import { newNode, toFlowDoc, toReactFlow, type FlowNodeData } from "./model";
import { flowToJson } from "./schema";
import { sample } from "./sample";

let pasteSeq = 0; // 避免新節點都疊在同一點

function FlowBuilderInner() {
  const t = useTranslations("ToolUI");
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
    pasteSeq += 1;
    setNodes((ns) => [...ns, newNode(type, { x: 120 + pasteSeq * 24, y: 260 + pasteSeq * 16 })]);
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

      <div className="grid grid-cols-[1fr_320px] gap-3">
        <div className="h-[520px] rounded-md border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e: React.MouseEvent, n: Node) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("flowInspector")}</p>
          <Inspector
            key={selected?.id ?? "none"}
            node={selected ? { id: selected.id, data: selected.data as FlowNodeData } : null}
            onConfigChange={onConfigChange}
            labels={{
              filter: filterLabels,
              actionKinds: ["notify", "db.update", "http"],
              selectHint: t("flowSelectHint"),
              noSettings: t("flowNoSettings"),
              actionKindLabel: t("flowActionKind"),
            }}
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("flowJson")}</p>
        <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed">{json}</pre>
      </div>
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
