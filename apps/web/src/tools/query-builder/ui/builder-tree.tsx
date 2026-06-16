"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { getEngine, type EngineId } from "@/tools/query-builder/logic/engines";
import { addCondition, addGroup, removeNode, setLogic, updateNode } from "@/tools/query-builder/logic/tree-ops";
import type { BuilderCondition, BuilderGroup, FieldSchema, LogicOp } from "@/tools/query-builder/logic/types";

import { ValueEditor } from "./value-editor";

const LOGIC_LABELS: Record<LogicOp, string> = {
  and: "全部成立 / All",
  or: "擇一成立 / Any",
  nor: "皆不成立 / None",
  not: "非全部 / Not all",
};

const id = () => crypto.randomUUID();

export function GroupNode({
  group,
  engineId,
  schema,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: BuilderGroup;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (next: BuilderGroup) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "rounded-sm border border-border p-2" : ""}>
      <div className="mb-2 flex items-center gap-2">
        <select
          aria-label="logic"
          value={group.logic}
          onChange={(e) => onChange(setLogic(group, group.id, e.target.value as LogicOp))}
          className="rounded-sm border bg-transparent px-2 py-1 text-sm"
        >
          {(Object.keys(LOGIC_LABELS) as LogicOp[]).map((l) => (
            <option key={l} value={l}>{LOGIC_LABELS[l]}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onChange(addCondition(group, group.id, id))}>
          + 條件
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange(addGroup(group, group.id, id))}>
          + 群組
        </Button>
        {onRemove ? (
          <Button size="sm" variant="ghost" aria-label="remove group" onClick={onRemove}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 pl-3">
        {group.children.map((child) =>
          child.kind === "group" ? (
            <GroupNode
              key={child.id}
              group={child}
              engineId={engineId}
              schema={schema}
              depth={depth + 1}
              onChange={(nextChild) =>
                onChange({ ...group, children: group.children.map((c) => (c.id === child.id ? nextChild : c)) })
              }
              onRemove={() => onChange(removeNode(group, child.id))}
            />
          ) : (
            <ConditionRow
              key={child.id}
              condition={child}
              engineId={engineId}
              schema={schema}
              onChange={(patch) => onChange(updateNode(group, child.id, patch))}
              onRemove={() => onChange(removeNode(group, child.id))}
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
}: {
  condition: BuilderCondition;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (patch: Omit<Partial<BuilderCondition>, "kind" | "id">) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("ToolUI");
  const fields = schema.filter((f) => f.include);
  const engine = getEngine(engineId);
  const ops = engine.operators(condition.dataType, condition.elementType);
  const arity = ops.find((o) => o.op === condition.operator)?.arity ?? "one";

  function onField(path: string) {
    const f = schema.find((s) => s.path === path);
    if (!f) return;
    const nextOps = engine.operators(f.dataType, f.elementType);
    onChange({
      field: f.path,
      dataType: f.dataType,
      elementType: f.elementType,
      operator: nextOps[0]?.op ?? "",
      value: "",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="field"
        value={condition.field}
        onChange={(e) => onField(e.target.value)}
        className="rounded-sm border bg-transparent px-2 py-1 text-sm"
      >
        <option value="">—</option>
        {fields.map((f) => (
          <option key={f.path} value={f.path}>{f.path}</option>
        ))}
      </select>
      <select
        aria-label="operator"
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value, value: "" })}
        className="rounded-sm border bg-transparent px-2 py-1 font-mono text-sm"
      >
        {ops.map((o) => (
          <option key={o.op} value={o.op}>{o.op}</option>
        ))}
      </select>
      {condition.operator === "elemmatch" ? (
        <span className="text-xs text-muted-foreground">{t("elemMatchPlaceholder")}</span>
      ) : (
        <ValueEditor
          dataType={condition.dataType === "array" ? (condition.elementType ?? "string") : condition.dataType}
          arity={arity}
          value={condition.value}
          onChange={(v) => onChange({ value: v })}
        />
      )}
      <Button size="sm" variant="ghost" aria-label="remove condition" onClick={onRemove}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
