"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowNodeData } from "./model";
import type { FlowNodeType } from "./schema";

const META: Record<FlowNodeType, { label: string; color: string; bg: string }> = {
  start: { label: "Start", color: "#475569", bg: "#f1f5f9" },
  end: { label: "End", color: "#047857", bg: "#ecfdf5" },
  form: { label: "Form", color: "#1d4ed8", bg: "#eff6ff" },
  condition: { label: "Condition", color: "#b45309", bg: "#fffbeb" },
  action: { label: "Action", color: "#6d28d9", bg: "#f5f3ff" },
};

function Shell({ type, title, children }: { type: FlowNodeType; title: string; children?: React.ReactNode }) {
  const m = META[type];
  return (
    <div className="min-w-[150px] rounded-lg border bg-card shadow-sm" style={{ borderColor: m.color + "55" }}>
      <div className="flex items-center gap-2 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: m.bg, color: m.color }}>
        <span>{title}</span>
      </div>
      {children ? <div className="px-2.5 py-2 text-[11px] text-muted-foreground">{children}</div> : null}
    </div>
  );
}

function fieldCount(config: unknown): number {
  const c = config as { fields?: unknown[]; sections?: { rows?: { items?: unknown[] }[] }[] } | undefined;
  if (!c) return 0;
  if (Array.isArray(c.fields)) return c.fields.length;
  if (Array.isArray(c.sections)) return c.sections.reduce((n, s) => n + (s.rows ?? []).reduce((m, r) => m + (r.items?.length ?? 0), 0), 0);
  return 0;
}

const StartNode = () => (
  <Shell type="start" title={META.start.label}>
    <Handle type="source" position={Position.Right} />
  </Shell>
);
const EndNode = () => (
  <Shell type="end" title={META.end.label}>
    <Handle type="target" position={Position.Left} />
  </Shell>
);
const FormNode = ({ data }: NodeProps) => {
  const d = data as FlowNodeData;
  return (
    <Shell type="form" title={META.form.label}>
      <Handle type="target" position={Position.Left} />
      {`${fieldCount(d.config)} fields`}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ActionNode = ({ data }: NodeProps) => {
  const d = data as FlowNodeData;
  const kind = (d.config as { kind?: string } | undefined)?.kind ?? "—";
  return (
    <Shell type="action" title={META.action.label}>
      <Handle type="target" position={Position.Left} />
      {`kind: ${kind}`}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ConditionNode = () => (
  <Shell type="condition" title={META.condition.label}>
    <Handle type="target" position={Position.Left} />
    <Handle id="yes" type="source" position={Position.Right} style={{ top: "35%" }} />
    <Handle id="no" type="source" position={Position.Right} style={{ top: "65%" }} />
  </Shell>
);

export const nodeTypes: Record<FlowNodeType, React.ComponentType<NodeProps>> = {
  start: StartNode as React.ComponentType<NodeProps>,
  end: EndNode as React.ComponentType<NodeProps>,
  form: FormNode,
  condition: ConditionNode as React.ComponentType<NodeProps>,
  action: ActionNode,
};
