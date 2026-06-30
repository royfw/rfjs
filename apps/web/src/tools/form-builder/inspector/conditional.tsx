"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import type { ConditionalRule } from "@rfjs/form-builder";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

type Condition = { field: string; dataType: string; operator: string; value?: unknown };
type Filter = Condition | ConditionalRule;
type SiblingField = { key: string; dataType: string };
const LOGICS = ["and", "or", "nor", "not"] as const;
const OPERATORS_BY_TYPE: Record<string, readonly string[]> = {
  string: ["eq", "neq", "contains", "startswith", "endswith", "terms", "isnull", "isnotnull"],
  numeric: ["eq", "neq", "gt", "gte", "lt", "lte", "terms", "isnull", "isnotnull"],
  date: ["eq", "neq", "gt", "gte", "lt", "lte", "terms", "isnull", "isnotnull"],
  boolean: ["eq", "neq", "isnull", "isnotnull"],
};
const isGroup = (f: Filter): f is ConditionalRule => typeof (f as ConditionalRule).logic === "string";

function GroupEditor({ group, siblingFields, onChange, onRemove, depth }: {
  group: ConditionalRule; siblingFields: SiblingField[]; onChange: (g: ConditionalRule) => void; onRemove?: () => void; depth: number;
}) {
  const filters = group.filters as Filter[];
  const setFilter = (i: number, f: Filter) => onChange({ ...group, filters: filters.map((x, j) => (j === i ? f : x)) } as ConditionalRule);
  const removeFilter = (i: number) => onChange({ ...group, filters: filters.filter((_, j) => j !== i) } as ConditionalRule);
  const addCondition = () => {
    const first = siblingFields[0];
    onChange({ ...group, filters: [...filters, { field: first?.key ?? "", dataType: first?.dataType ?? "string", operator: "eq", value: "" }] } as ConditionalRule);
  };
  const addGroup = () => onChange({ ...group, filters: [...filters, { logic: "and", filters: [] }] } as ConditionalRule);
  return (
    <div className={`flex flex-col gap-2 ${depth > 0 ? "border-l border-border pl-3" : ""}`}>
      <div className="flex items-center gap-2">
        <select aria-label="group logic" className={`${INPUT_CLS} w-20`} value={group.logic} onChange={(e) => onChange({ ...group, logic: e.target.value as ConditionalRule["logic"] })}>
          {LOGICS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        {onRemove ? <button type="button" aria-label="remove group" className="text-muted-foreground hover:text-destructive" onClick={onRemove}><X className="size-4" /></button> : null}
      </div>
      {filters.map((f, i) =>
        isGroup(f) ? (
          <GroupEditor key={i} group={f} siblingFields={siblingFields} depth={depth + 1} onChange={(g) => setFilter(i, g)} onRemove={() => removeFilter(i)} />
        ) : (
          <div key={i} className="flex items-center gap-1.5">
            <select
              aria-label={`field ${i}`}
              className={INPUT_CLS}
              value={f.field}
              onChange={(e) => {
                const sibling = siblingFields.find((s) => s.key === e.target.value);
                setFilter(i, { ...f, field: e.target.value, dataType: sibling?.dataType ?? "string" });
              }}
            >
              {siblingFields.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
            </select>
            <select aria-label={`operator ${i}`} className={`${INPUT_CLS} w-24`} value={f.operator} onChange={(e) => setFilter(i, { ...f, operator: e.target.value })}>
              {(OPERATORS_BY_TYPE[f.dataType] ?? OPERATORS_BY_TYPE.string ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <input aria-label={`value ${i}`} className={INPUT_CLS} value={String(f.value ?? "")} onChange={(e) => setFilter(i, { ...f, value: e.target.value })} />
            <button type="button" aria-label="remove condition" className="text-muted-foreground hover:text-destructive" onClick={() => removeFilter(i)}><X className="size-4" /></button>
          </div>
        ),
      )}
      <div className="flex gap-2">
        <button type="button" aria-label="add condition" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={addCondition}><Plus className="size-3.5" /> condition</button>
        <button type="button" aria-label="add group" className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={addGroup}><Plus className="size-3.5" /> group</button>
      </div>
    </div>
  );
}

export function ConditionalSection({ card, siblingFields, onChange }: { card: Card; siblingFields: SiblingField[]; onChange: (p: Partial<Card>) => void }) {
  const rule = card.conditional;
  if (!rule) {
    return (
      <button type="button" aria-label="enable condition" className="inline-flex items-center gap-1.5 self-start rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => onChange({ conditional: { logic: "and", filters: [] } })}>
        <Plus className="size-3.5" /> Enable conditional display
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <GroupEditor group={rule} siblingFields={siblingFields} depth={0} onChange={(g) => onChange({ conditional: g })} />
      <button type="button" className="self-start text-xs text-muted-foreground hover:text-destructive" onClick={() => onChange({ conditional: undefined })}>Remove conditional</button>
    </div>
  );
}
