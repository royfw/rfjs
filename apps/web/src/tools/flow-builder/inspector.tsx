"use client";

import * as React from "react";

import { ConfigFormBuilder } from "@rfjs/form-builder-ui";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { emptyGroup } from "@rfjs/filter-builder";
import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";
import type { FormConfig } from "@rfjs/form-builder";

import type { FlowNodeData } from "./model";

export interface InspectorProps {
  node: { id: string; data: FlowNodeData } | null;
  onConfigChange: (id: string, config: unknown) => void;
  labels: {
    filter: FilterTreeLabels;
    actionKinds: string[];
    selectHint: string;
    noSettings: string;
    actionKindLabel: string;
  };
}

const uuid = () => crypto.randomUUID();

// Phase 1: condition's available fields use a sample set (real fields are a Phase 2 context concern).
const SAMPLE_SCHEMA: FieldSchema[] = [
  { path: "days", dataType: "numeric", include: true, kind: "jsonb" },
  { path: "amount", dataType: "numeric", include: true, kind: "jsonb" },
  { path: "status", dataType: "string", include: true, kind: "jsonb" },
];

function ActionInspector({ id, config, kinds, kindLabel, onConfigChange }: { id: string; config: unknown; kinds: string[]; kindLabel: string; onConfigChange: InspectorProps["onConfigChange"] }) {
  const c = (config as { kind?: string; params?: Record<string, unknown> }) ?? {};
  return (
    <div className="space-y-2">
      <label htmlFor="flow-action-kind" className="block text-xs text-muted-foreground">{kindLabel}</label>
      <select
        id="flow-action-kind"
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        value={c.kind ?? kinds[0]}
        onChange={(e) => onConfigChange(id, { kind: e.target.value, params: c.params ?? {} })}
      >
        {kinds.map((k) => (<option key={k} value={k}>{k}</option>))}
      </select>
    </div>
  );
}

function ConditionInspector({ id, config, labels, onConfigChange }: { id: string; config: unknown; labels: FilterTreeLabels; onConfigChange: InspectorProps["onConfigChange"] }) {
  const [tree, setTree] = React.useState<BuilderGroup>(() => (config as BuilderGroup) ?? emptyGroup(uuid));
  const [schema, setSchema] = React.useState<FieldSchema[]>(SAMPLE_SCHEMA);
  return (
    <FilterTreeEditor
      group={tree}
      engineId="data-filter"
      schema={schema}
      labels={labels}
      onChange={(next) => { setTree(next); onConfigChange(id, next); }}
      onCreateField={(path) => setSchema((s) => [...s, { path, dataType: "string", include: true, kind: "jsonb" }])}
    />
  );
}

export function Inspector({ node, onConfigChange, labels }: InspectorProps) {
  if (!node) return <p className="text-sm text-muted-foreground">{labels.selectHint}</p>;
  const { id, data } = node;
  switch (data.type) {
    case "form":
      return (
        <ConfigFormBuilder
          initialConfig={(data.config as FormConfig) ?? { version: 1, fields: [] }}
          onChange={(cfg) => onConfigChange(id, cfg)}
          locale="en"
          locales={["en", "zh-TW"]}
        />
      );
    case "condition":
      return <ConditionInspector id={id} config={data.config} labels={labels.filter} onConfigChange={onConfigChange} />;
    case "action":
      return <ActionInspector id={id} config={data.config} kinds={labels.actionKinds} kindLabel={labels.actionKindLabel} onConfigChange={onConfigChange} />;
    default:
      return <p className="text-sm text-muted-foreground">{labels.noSettings}</p>;
  }
}
