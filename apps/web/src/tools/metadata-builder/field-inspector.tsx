"use client";

import * as React from "react";

import { Button } from "@rfjs/web-ui/components/button";

import { formatOptionsFor, type FieldRow, type OptionRow } from "./model";
import type { FieldsPanelLabels } from "./fields-panel";

const DATA_TYPES: FieldRow["dataType"][] = ["string", "numeric", "date", "boolean"];
const KINDS: NonNullable<FieldRow["kind"]>[] = ["column", "jsonb"];

const inputClass = "h-7 rounded-md border border-input bg-transparent px-1.5 text-xs";

function segClass(active: boolean) {
  return `rounded px-2 py-1 text-xs ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`;
}

function Seg({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted/30 p-0.5">{children}</div>;
}

export function FieldInspector({
  row,
  onPatch,
  onPatchDataType,
  labels,
}: {
  row: FieldRow | null;
  onPatch: (partial: Partial<FieldRow>) => void;
  onPatchDataType: (dataType: FieldRow["dataType"]) => void;
  labels: FieldsPanelLabels;
}) {
  if (row === null) {
    return <p className="text-xs text-muted-foreground">{labels.inspectorEmpty}</p>;
  }

  const formatOptions = formatOptionsFor(row.dataType);

  function patchOption(optionId: string, partial: Partial<OptionRow>) {
    onPatch({ options: row!.options.map((o) => (o.id === optionId ? { ...o, ...partial } : o)) });
  }
  function removeOption(optionId: string) {
    onPatch({ options: row!.options.filter((o) => o.id !== optionId) });
  }
  function addOption() {
    onPatch({ options: [...row!.options, { id: crypto.randomUUID(), value: "", labelEn: "", labelZh: "" }] });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
        {labels.inspectorTitle} · {row.key}
      </p>

      <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2">
        <span className="text-[11px] text-muted-foreground">{labels.labelEn}</span>
        <input
          type="text"
          value={row.labelEn}
          onChange={(e) => onPatch({ labelEn: e.target.value })}
          className={`${inputClass} w-40`}
          aria-label={labels.labelEn}
        />

        <span className="text-[11px] text-muted-foreground">{labels.labelZh}</span>
        <input
          type="text"
          value={row.labelZh}
          onChange={(e) => onPatch({ labelZh: e.target.value })}
          className={`${inputClass} w-40`}
          aria-label={labels.labelZh}
        />

        <span className="text-[11px] text-muted-foreground">{labels.key}</span>
        <input
          type="text"
          value={row.key}
          onChange={(e) => onPatch({ key: e.target.value })}
          autoFocus={row.key === ""}
          className={`${inputClass} w-40 font-mono`}
          aria-label={labels.key}
        />

        <span className="text-[11px] text-muted-foreground">{labels.dataType}</span>
        <div role="group" aria-label={labels.dataType}>
          <Seg>
            {DATA_TYPES.map((dt) => (
              <button
                key={dt}
                type="button"
                aria-pressed={row.dataType === dt}
                onClick={() => onPatchDataType(dt)}
                className={segClass(row.dataType === dt)}
              >
                {dt}
              </button>
            ))}
          </Seg>
        </div>

        {formatOptions.length > 0 && (
          <>
            <span className="text-[11px] text-muted-foreground">{labels.format}</span>
            <div role="group" aria-label={labels.format}>
              <Seg>
                <button
                  type="button"
                  aria-pressed={row.format === undefined}
                  onClick={() => onPatch({ format: undefined })}
                  className={segClass(row.format === undefined)}
                >
                  {labels.formatNone}
                </button>
                {formatOptions.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={row.format === f}
                    onClick={() => onPatch({ format: f })}
                    className={segClass(row.format === f)}
                  >
                    {f}
                  </button>
                ))}
              </Seg>
            </div>
          </>
        )}

        <span className="text-[11px] text-muted-foreground">{labels.kind}</span>
        <div role="group" aria-label={labels.kind}>
          <Seg>
            <button
              type="button"
              aria-pressed={row.kind === undefined}
              onClick={() => onPatch({ kind: undefined })}
              className={segClass(row.kind === undefined)}
            >
              {labels.kindNone}
            </button>
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={row.kind === k}
                onClick={() => onPatch({ kind: k })}
                className={segClass(row.kind === k)}
              >
                {k}
              </button>
            ))}
          </Seg>
        </div>

        <span />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={row.sortable}
              onChange={(e) => onPatch({ sortable: e.target.checked })}
              aria-label={labels.sortable}
            />
            {labels.sortable}
          </label>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={row.filterable}
              onChange={(e) => onPatch({ filterable: e.target.checked })}
              aria-label={labels.filterable}
            />
            {labels.filterable}
          </label>
        </div>
      </div>

      <div data-testid="options-editor" className="mt-1 rounded-md border border-dashed border-input bg-muted/30 p-2">
        {row.options.map((o) => (
          <div key={o.id} className="flex items-center gap-2 py-0.5">
            <input
              type="text"
              value={o.value}
              onChange={(e) => patchOption(o.id, { value: e.target.value })}
              className={`${inputClass} w-24 font-mono`}
              aria-label={`${labels.options} ${row.key} value`}
            />
            <input
              type="text"
              value={o.labelEn}
              onChange={(e) => patchOption(o.id, { labelEn: e.target.value })}
              className={`${inputClass} w-24`}
              aria-label={`${labels.options} ${row.key} ${labels.labelEn}`}
            />
            <input
              type="text"
              value={o.labelZh}
              onChange={(e) => patchOption(o.id, { labelZh: e.target.value })}
              className={`${inputClass} w-24`}
              aria-label={`${labels.options} ${row.key} ${labels.labelZh}`}
            />
            <button
              type="button"
              onClick={() => removeOption(o.id)}
              aria-label={labels.remove}
              className="text-muted-foreground hover:text-destructive"
            >
              ✕
            </button>
          </div>
        ))}
        <Button type="button" size="xs" variant="outline" onClick={addOption}>
          {labels.addOption}
        </Button>
      </div>
    </div>
  );
}
