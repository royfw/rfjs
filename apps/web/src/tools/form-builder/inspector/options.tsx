"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import type { FieldOption } from "@rfjs/form-builder";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

export function OptionsSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const options = card.options ?? [];
  const setOptions = (next: FieldOption[]) => onChange({ options: next.length ? next : undefined });
  const update = (i: number, patch: Partial<FieldOption>) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="flex flex-col gap-2">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input aria-label={`option label ${i}`} className={INPUT_CLS} value={o.label} onChange={(e) => update(i, { label: e.target.value })} />
          <input aria-label={`option value ${i}`} className={`${INPUT_CLS} font-mono`} value={String(o.value)} onChange={(e) => update(i, { value: e.target.value })} />
          <button type="button" aria-label="remove option" className="text-muted-foreground hover:text-destructive" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
            <X className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" aria-label="add option" className="inline-flex items-center gap-1.5 self-start rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setOptions([...options, { label: "", value: "" }])}>
        <Plus className="size-3.5" /> Add option
      </button>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Default value
        <select className={INPUT_CLS} value={String(card.defaultValue ?? "")} onChange={(e) => onChange({ defaultValue: e.target.value || undefined })}>
          <option value="">— none —</option>
          {options.map((o, i) => <option key={i} value={String(o.value)}>{o.label || String(o.value)}</option>)}
        </select>
      </label>
    </div>
  );
}
