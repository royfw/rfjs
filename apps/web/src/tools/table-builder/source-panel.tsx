"use client";

import * as React from "react";

import type { SourceMode } from "./sample";
import { parseImport } from "./import";
import type { ImportFormat } from "./import";

export interface SourcePanelLabels {
  title: string;
  rows: string;
  fetcher: string;
  offset: string;
  page: string;
  cursor: string;
}

export interface SourcePanelImportLabels {
  paste: string;
  upload: string;
  load: string;
  json: string;
  csv: string;
}

export interface SourcePanelProps {
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  labels: SourcePanelLabels;
  onImport?: (rows: Record<string, unknown>[]) => void;
  importLabels?: SourcePanelImportLabels;
  /** Initial paste-box contents (e.g. the sample rows as JSON) so the box is a usable, editable example. */
  defaultText?: string;
}

// Fetcher strategies shown once 'rows' is switched off (design spec §6.1: "靜態 rows ↔ 假
// fetcher 切換;fetcher 模式再切 offset / page / cursor"). Clicking "fetcher" from 'rows' always
// lands on 'offset' -- the strategy row below then lets the user pick a different one.
const REMOTE_MODES: Exclude<SourceMode, "rows">[] = ["offset", "page", "cursor"];

function segmentClass(active: boolean): string {
  return [
    "rounded-md border px-2 py-1 text-xs",
    active ? "border-primary bg-primary/10 font-medium" : "border-input text-muted-foreground",
  ].join(" ");
}

export function SourcePanel({ mode, onModeChange, labels, onImport, importLabels, defaultText }: SourcePanelProps) {
  const isRemote = mode !== "rows";
  const [format, setFormat] = React.useState<ImportFormat>("json");
  const [text, setText] = React.useState(defaultText ?? "");
  const [error, setError] = React.useState<string | null>(null);

  function runImport(nextText: string) {
    const result = parseImport(nextText, format);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onImport?.(result.rows);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const nextFormat: ImportFormat = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
    setFormat(nextFormat);
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      const result = parseImport(content, nextFormat);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      onImport?.(result.rows);
    };
    reader.readAsText(file);
  }

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-semibold">{labels.title}</p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          <button type="button" className={segmentClass(!isRemote)} onClick={() => onModeChange("rows")}>
            {labels.rows}
          </button>
          <button type="button" className={segmentClass(isRemote)} onClick={() => onModeChange("offset")}>
            {labels.fetcher}
          </button>
        </div>
        {isRemote ? (
          <div className="flex gap-1">
            {REMOTE_MODES.map((strategy) => (
              <button
                key={strategy}
                type="button"
                className={segmentClass(mode === strategy)}
                onClick={() => onModeChange(strategy)}
              >
                {labels[strategy]}
              </button>
            ))}
          </div>
        ) : null}
        {!isRemote && importLabels ? (
          <div className="flex flex-col gap-2 border-t pt-2">
            <div className="flex gap-1">
              <button type="button" className={segmentClass(format === "json")} onClick={() => setFormat("json")}>
                {importLabels.json}
              </button>
              <button type="button" className={segmentClass(format === "csv")} onClick={() => setFormat("csv")}>
                {importLabels.csv}
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={importLabels.paste}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs text-muted-foreground">
                {importLabels.upload}
                <input type="file" accept=".json,.csv" className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
                onClick={() => runImport(text)}
              >
                {importLabels.load}
              </button>
            </div>
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
