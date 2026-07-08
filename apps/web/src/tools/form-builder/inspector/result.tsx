"use client";
import * as React from "react";

import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

const MODES = ["card", "json", "table"] as const;

export function ResultSection({
  card, onChange, apiButtons = [],
}: { card: Card; onChange: (p: Partial<Card>) => void; apiButtons?: { id: string; label: string }[] }) {
  const mode = card.mode ?? "json";
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Mode
        <select className={INPUT_CLS} value={mode} onChange={(e) => onChange({ mode: e.target.value as Card["mode"] })}>
          {MODES.map((m) => (
            <option key={m} value={m}>{m === "table" ? "table (coming soon)" : m}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Source
        <select
          className={INPUT_CLS}
          value={card.sourceId ?? ""}
          onChange={(e) => onChange({ sourceId: e.target.value || undefined })}
        >
          <option value="">Last api response</option>
          {apiButtons.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Data path
        <input className={`${INPUT_CLS} font-mono`} value={card.dataPath ?? ""} placeholder="e.g. data.items" onChange={(e) => onChange({ dataPath: e.target.value || undefined })} />
      </label>

      {mode === "card" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Max items
          <input
            className={INPUT_CLS} type="number" min={1}
            value={card.maxItems ?? 10}
            onChange={(e) => { const n = Number(e.target.value); onChange({ maxItems: Number.isFinite(n) && n >= 1 ? n : undefined }); }}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Empty text
        <input className={INPUT_CLS} value={card.emptyText ?? ""} placeholder="No result yet" onChange={(e) => onChange({ emptyText: e.target.value || undefined })} />
      </label>
    </div>
  );
}
