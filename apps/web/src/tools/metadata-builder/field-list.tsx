"use client";

import * as React from "react";

import { Button } from "@rfjs/web-ui/components/button";
import { cn } from "@rfjs/web-ui/lib/utils";

import type { FieldRow } from "./model";
import type { FieldsPanelLabels } from "./fields-panel";

function KindPill({ kind, labels }: { kind: FieldRow["kind"]; labels: FieldsPanelLabels }) {
  if (kind === "column") {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
        {kind}
      </span>
    );
  }
  if (kind === "jsonb") {
    return (
      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400">
        {kind}
      </span>
    );
  }
  return (
    <span className="rounded border border-dashed border-input px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {labels.kind} {labels.kindNone}
    </span>
  );
}

export function FieldList({
  rows,
  selectedId,
  onSelect,
  onRemove,
  onAdd,
  dupKeys,
  labels,
}: {
  rows: FieldRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  dupKeys: Set<string>;
  labels: FieldsPanelLabels;
}) {
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    } else if (e.key === "Escape") {
      onSelect(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="listbox" className="flex flex-col">
        {rows.map((r, idx) => {
          const keyInvalid = r.key.trim() === "";
          const keyDup = !keyInvalid && dupKeys.has(r.key);
          const selected = r.id === selectedId;
          return (
            <div
              key={r.id}
              role="option"
              tabIndex={0}
              aria-selected={selected}
              onClick={() => onSelect(r.id)}
              onKeyDown={(e) => onKeyDown(e, r.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5",
                selected ? "bg-primary/10 outline outline-1 outline-primary/40" : "hover:bg-muted/50",
              )}
            >
              <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">{idx + 1}</span>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {keyInvalid ? (
                  <span className="font-mono text-xs italic text-destructive/80">{labels.blankKey}</span>
                ) : (
                  <span className="truncate font-mono text-xs font-semibold">{r.key}</span>
                )}
                <span className="font-mono text-[10px] text-muted-foreground">{r.dataType}</span>
                <KindPill kind={r.kind} labels={labels} />
                {r.sortable && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{labels.sortable}</span>}
                {r.filterable && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{labels.filterable}</span>
                )}
                {r.options.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">enum·{r.options.length}</span>
                )}
                {keyInvalid ? (
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                ) : (
                  keyDup && <span className="text-[10px] text-destructive">{labels.dupKey}</span>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(r.id);
                }}
                aria-label={labels.remove}
                className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          {labels.addField}
        </Button>
        <span className="text-[10px] text-muted-foreground">{labels.fieldSummary}</span>
      </div>
    </div>
  );
}
