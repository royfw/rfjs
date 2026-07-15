"use client";
import * as React from "react";

import { INPUT_CLS } from "./constants";
import type { Card } from "../model";
import { snapshotTableConfig } from "./result-table-snapshot";

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
            <option key={m} value={m}>{m}</option>
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
          {card.sourceId && !apiButtons.some((b) => b.id === card.sourceId) && (
            <option value={card.sourceId}>{`missing: ${card.sourceId}`}</option>
          )}
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
            onChange={(e) => { const n = Number(e.target.value); onChange({ maxItems: Number.isInteger(n) && n >= 1 ? n : undefined }); }}
          />
        </label>
      )}

      {mode === "table" && <TableSnapshot card={card} onChange={onChange} />}

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Empty text
        <input className={INPUT_CLS} value={card.emptyText ?? ""} placeholder="No result yet" onChange={(e) => onChange({ emptyText: e.target.value || undefined })} />
      </label>
    </div>
  );
}

function TableSnapshot({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const columnCount = card.resultTable?.columns.length ?? 0;

  function doSnapshot() {
    const { config, error: err } = snapshotTableConfig(text);
    if (err || !config) {
      setError(err ?? "Could not read the sample");
      return;
    }
    setError(null);
    onChange({ resultTable: config });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-input bg-muted/20 p-2">
      <span className="text-xs text-muted-foreground">
        {columnCount > 0 ? `${columnCount} columns captured — edit in the JSON tab` : "No columns yet — auto-derived from the response, or snapshot a sample:"}
      </span>
      <textarea
        className={`${INPUT_CLS} font-mono`}
        rows={3}
        value={text}
        placeholder='Paste a sample response, e.g. [{"id":1,"name":"Ada"}]'
        onChange={(e) => setText(e.target.value)}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
      <div className="flex gap-2">
        <button type="button" className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted" onClick={doSnapshot}>
          Snapshot columns
        </button>
        {columnCount > 0 && (
          <button type="button" className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted" onClick={() => onChange({ resultTable: undefined })}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
