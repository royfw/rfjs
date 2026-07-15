"use client";

import { useTranslations } from "next-intl";
import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowNodeType } from "@rfjs/flow-core";

import type { FlowNodeData } from "./model";

// 邊框/表頭配色:light 用淡色底深字,dark 用深色底亮字(避免全暗看不清)。
const META: Record<FlowNodeType, { border: string; head: string }> = {
  start: {
    border: "border-slate-300 dark:border-slate-500",
    head: "bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-200",
  },
  end: {
    border: "border-emerald-300 dark:border-emerald-600",
    head: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  },
  form: {
    border: "border-blue-300 dark:border-blue-600",
    head: "bg-blue-50 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
  },
  condition: {
    border: "border-amber-300 dark:border-amber-600",
    head: "bg-amber-50 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  },
  action: {
    border: "border-violet-300 dark:border-violet-600",
    head: "bg-violet-50 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300",
  },
};

function Shell({ type, title, children }: { type: FlowNodeType; title: string; children?: React.ReactNode }) {
  const m = META[type];
  return (
    <div className={`min-w-[150px] rounded-lg border bg-card shadow-sm ${m.border}`}>
      <div className={`flex items-center gap-2 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold ${m.head}`}>
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

const StartNode = () => {
  const t = useTranslations("ToolUI");
  return (
    <Shell type="start" title={t("flowNodeStart")}>
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const EndNode = () => {
  const t = useTranslations("ToolUI");
  return (
    <Shell type="end" title={t("flowNodeEnd")}>
      <Handle type="target" position={Position.Left} />
    </Shell>
  );
};
const FormNode = ({ data }: NodeProps) => {
  const t = useTranslations("ToolUI");
  const d = data as FlowNodeData;
  return (
    <Shell type="form" title={t("flowNodeForm")}>
      <Handle type="target" position={Position.Left} />
      {t("flowNodeFields", { count: fieldCount(d.config) })}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ActionNode = ({ data }: NodeProps) => {
  const t = useTranslations("ToolUI");
  const d = data as FlowNodeData;
  const kind = (d.config as { kind?: string } | undefined)?.kind ?? "—";
  return (
    <Shell type="action" title={t("flowNodeAction")}>
      <Handle type="target" position={Position.Left} />
      {t("flowNodeKind", { kind })}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ConditionNode = () => {
  const t = useTranslations("ToolUI");
  return (
    <Shell type="condition" title={t("flowNodeCondition")}>
      <Handle type="target" position={Position.Left} />
      <Handle id="yes" type="source" position={Position.Right} style={{ top: "35%" }} />
      <Handle id="no" type="source" position={Position.Right} style={{ top: "65%" }} />
    </Shell>
  );
};

export const nodeTypes: Record<FlowNodeType, React.ComponentType<NodeProps>> = {
  start: StartNode as React.ComponentType<NodeProps>,
  end: EndNode as React.ComponentType<NodeProps>,
  form: FormNode,
  condition: ConditionNode as React.ComponentType<NodeProps>,
  action: ActionNode,
};
