"use client";

import { useEffect } from "react";

import { Button } from "@rfjs/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";
import { X } from "lucide-react";

import { getEngine, addCondition, addGroup, removeNode, setLogic, updateNode } from "@rfjs/filter-builder";
import type { EngineId, BuilderCondition, BuilderGroup, FieldSchema, LogicOp } from "@rfjs/filter-builder";

import { logicColor, dataTypeColor } from "./colors";
import { FieldCombobox } from "./field-combobox";
import { ValueEditor } from "./value-editor";

export interface FilterTreeLabels {
  logic: Record<LogicOp, string>;
  addCondition: string;
  addGroup: string;
  removeGroup: string;
  removeCondition: string;
  elemMatch: string;
}

const id = () => crypto.randomUUID();

export function FilterTreeEditor({
  group,
  engineId,
  schema,
  onChange,
  onCreateField,
  labels,
  onRemove,
  depth = 0,
}: {
  group: BuilderGroup;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (next: BuilderGroup) => void;
  onCreateField: (path: string) => void;
  labels: FilterTreeLabels;
  onRemove?: () => void;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "rounded-md border border-border p-2" : ""}>
      <div className="mb-2 flex items-center gap-2">
        <Select
          value={group.logic}
          onValueChange={(v) => onChange(setLogic(group, group.id, v as LogicOp))}
        >
          <SelectTrigger
            size="sm"
            aria-label="logic"
            className={`w-auto ${logicColor(group.logic)}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(labels.logic) as LogicOp[]).map((l) => (
              <SelectItem key={l} value={l}>
                {labels.logic[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => onChange(addCondition(group, group.id, id))}>
          {labels.addCondition}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange(addGroup(group, group.id, id))}>
          {labels.addGroup}
        </Button>
        {onRemove ? (
          <Button size="sm" variant="ghost" aria-label={labels.removeGroup} onClick={onRemove}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="ml-1 flex flex-col gap-2 border-l border-slab-border pl-4">
        {group.children.map((child) =>
          child.kind === "group" ? (
            <FilterTreeEditor
              key={child.id}
              group={child}
              engineId={engineId}
              schema={schema}
              labels={labels}
              depth={depth + 1}
              onChange={(nextChild) =>
                onChange({ ...group, children: group.children.map((c) => (c.id === child.id ? nextChild : c)) })
              }
              onRemove={() => onChange(removeNode(group, child.id))}
              onCreateField={onCreateField}
            />
          ) : (
            <ConditionRow
              key={child.id}
              condition={child}
              engineId={engineId}
              schema={schema}
              labels={labels}
              onChange={(patch) => onChange(updateNode(group, child.id, patch))}
              onRemove={() => onChange(removeNode(group, child.id))}
              onCreateField={onCreateField}
            />
          ),
        )}
      </div>
    </div>
  );
}

function ConditionRow({
  condition,
  engineId,
  schema,
  onChange,
  onRemove,
  onCreateField,
  labels,
}: {
  condition: BuilderCondition;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (patch: Omit<Partial<BuilderCondition>, "kind" | "id">) => void;
  onRemove: () => void;
  onCreateField: (path: string) => void;
  labels: FilterTreeLabels;
}) {
  const fields = schema.filter((f) => f.include);
  const engine = getEngine(engineId);
  const field = schema.find((s) => s.path === condition.field);
  const dataType = field?.dataType ?? condition.dataType;
  const elementType = field?.elementType ?? condition.elementType;
  const fieldKind = field?.kind;
  const ops = engine.operators(dataType, elementType, fieldKind);
  const arity = ops.find((o) => o.op === condition.operator)?.arity ?? "one";
  const operatorValid = ops.some((o) => o.op === condition.operator);

  useEffect(() => {
    const patch: Omit<Partial<BuilderCondition>, "kind" | "id"> = {};
    if (field) {
      if (field.dataType !== condition.dataType) patch.dataType = field.dataType;
      if (field.elementType !== condition.elementType) patch.elementType = field.elementType;
    }
    if (condition.operator && !operatorValid) {
      patch.operator = ops[0]?.op ?? "";
      patch.value = "";
    }
    if (Object.keys(patch).length > 0) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineId, field?.dataType, field?.elementType, field?.kind, operatorValid]);

  function onField(path: string) {
    const f = schema.find((s) => s.path === path);
    const dataType = f?.dataType ?? "string";
    const elementType = f?.elementType;
    const kind = f?.kind ?? "jsonb";
    const nextOps = engine.operators(dataType, elementType, kind);
    onChange({ field: path, dataType, elementType, operator: nextOps[0]?.op ?? "", value: "" });
  }

  return (
    <div className="grid grid-cols-[minmax(9rem,1fr)_2.25rem_9.5rem_minmax(7rem,1.3fr)_auto] items-center gap-2">
      <FieldCombobox
        ariaLabel="field"
        value={condition.field}
        options={fields.map((f) => f.path)}
        onCommit={(path) => {
          if (path && !schema.some((s) => s.path === path)) onCreateField(path);
          onField(path);
        }}
      />
      {condition.field ? (
        <span className={`text-center font-mono text-[10px] ${dataTypeColor(dataType)}`}>
          {dataType}
        </span>
      ) : (
        <span aria-hidden />
      )}
      <Select
        value={condition.operator}
        onValueChange={(v) => onChange({ operator: v, value: "" })}
      >
        <SelectTrigger size="sm" aria-label="operator" className="w-full min-w-0 font-mono">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {ops.map((o) => (
            <SelectItem key={o.op} value={o.op} className="font-mono">
              {o.op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {condition.operator === "elemmatch" ? (
        <span className="truncate text-xs text-muted-foreground">{labels.elemMatch}</span>
      ) : (
        <ValueEditor
          dataType={dataType === "array" ? (elementType ?? "string") : dataType}
          arity={arity}
          value={condition.value}
          onChange={(v) => onChange({ value: v })}
        />
      )}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={labels.removeCondition}
        onClick={onRemove}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
