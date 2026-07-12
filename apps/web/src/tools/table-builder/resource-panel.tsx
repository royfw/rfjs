"use client";

import * as React from "react";

import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataResourceMeta } from "@rfjs/data-schema";

import { parseImport } from "./import";
import type { ImportFormat } from "./import";

/** Seed = where this resource comes from (design spec ② Z-model). */
export type SeedMode = "meta" | "rows" | "sample";
/** How the always-on preview fetches: simulate the protocol offline vs call the endpoint. */
export type PreviewMode = "offline" | "live";

export interface ResourcePanelLabels {
  title: string;
  seedMeta: string;
  seedRows: string;
  seedSample: string;
  metaPlaceholder: string;
  metaHint: string;
  metaInvalid: string;
  sampleHint: string;
  sampleLoad: string;
  /** Pre-substituted by the caller (t() with {count}). */
  fieldsSummary: string;
  protoHint: string;
  previewLabel: string;
  previewOffline: string;
  previewLive: string;
}

export interface ResourcePanelImportLabels {
  paste: string;
  upload: string;
  load: string;
  json: string;
  csv: string;
}

export interface ResourcePanelProps {
  labels: ResourcePanelLabels;
  importLabels: ResourcePanelImportLabels;
  onImportRows: (rows: Record<string, unknown>[]) => void;
  onImportMeta: (meta: DataResourceMeta) => void;
  onSampleReset: () => void;
  /** Initial paste-box contents for the rows seed (e.g. the sample rows as JSON). */
  defaultRowsText?: string;
  hasProtocol: boolean;
  preview: PreviewMode;
  onPreviewChange: (p: PreviewMode) => void;
}

function segmentClass(active: boolean): string {
  return [
    "rounded-md border px-2 py-1 text-xs",
    active ? "border-primary bg-primary/10 font-medium" : "border-input text-muted-foreground",
  ].join(" ");
}

export function ResourcePanel({
  labels,
  importLabels,
  onImportRows,
  onImportMeta,
  onSampleReset,
  defaultRowsText,
  hasProtocol,
  preview,
  onPreviewChange,
}: ResourcePanelProps) {
  const [seed, setSeed] = React.useState<SeedMode>("meta");
  const [format, setFormat] = React.useState<ImportFormat>("json");
  const [metaText, setMetaText] = React.useState("");
  const [rowsText, setRowsText] = React.useState(defaultRowsText ?? "");
  const [error, setError] = React.useState<string | null>(null);

  function switchSeed(next: SeedMode) {
    setSeed(next);
    setError(null);
  }

  function runMetaLoad(nextText: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(nextText);
    } catch {
      setError(labels.metaInvalid);
      return;
    }
    try {
      const meta = parseDataResourceMeta(parsed);
      setError(null);
      onImportMeta(meta);
    } catch (err) {
      // zod v4 err.message is a JSON issues array (first line "[") -- surface issues[0].message
      // instead (metadata-builder import-panel's established handling).
      const issues = (err as { issues?: { message?: string }[] }).issues;
      setError(issues?.[0]?.message ?? labels.metaInvalid);
    }
  }

  function runRowsLoad(nextText: string, nextFormat: ImportFormat) {
    const result = parseImport(nextText, nextFormat);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onImportRows(result.rows);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      if (seed === "meta") {
        setMetaText(content);
        runMetaLoad(content);
        return;
      }
      const nextFormat: ImportFormat = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
      setFormat(nextFormat);
      setRowsText(content);
      runRowsLoad(content, nextFormat);
    };
    reader.readAsText(file);
  }

  const accept = seed === "meta" ? ".json" : ".json,.csv";

  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-semibold">{labels.title}</p>
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {(
            [
              { id: "meta", label: labels.seedMeta },
              { id: "rows", label: labels.seedRows },
              { id: "sample", label: labels.seedSample },
            ] as { id: SeedMode; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={seed === item.id}
              className={segmentClass(seed === item.id)}
              onClick={() => switchSeed(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {seed === "meta" ? (
          <div className="flex flex-col gap-2 border-t pt-2">
            <textarea
              value={metaText}
              onChange={(e) => setMetaText(e.target.value)}
              placeholder={labels.metaPlaceholder}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs text-muted-foreground">
                {importLabels.upload}
                <input type="file" accept={accept} className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
                onClick={() => runMetaLoad(metaText)}
              >
                {importLabels.load}
              </button>
              <span className="text-xs text-muted-foreground">{labels.metaHint}</span>
            </div>
          </div>
        ) : null}

        {seed === "rows" ? (
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
              value={rowsText}
              onChange={(e) => setRowsText(e.target.value)}
              placeholder={importLabels.paste}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs"
            />
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs text-muted-foreground">
                {importLabels.upload}
                <input type="file" accept={accept} className="hidden" onChange={handleFileChange} />
              </label>
              <button
                type="button"
                className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
                onClick={() => runRowsLoad(rowsText, format)}
              >
                {importLabels.load}
              </button>
            </div>
          </div>
        ) : null}

        {seed === "sample" ? (
          <div className="flex items-center gap-2 border-t pt-2">
            <button
              type="button"
              className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
              onClick={onSampleReset}
            >
              {labels.sampleLoad}
            </button>
            <span className="text-xs text-muted-foreground">{labels.sampleHint}</span>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 border-t pt-2">
          <span className="text-xs text-muted-foreground">{labels.fieldsSummary}</span>
          <span className="text-xs text-muted-foreground">{labels.protoHint}</span>
          {hasProtocol ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{labels.previewLabel}</span>
              <button
                type="button"
                aria-pressed={preview === "offline"}
                className={segmentClass(preview === "offline")}
                onClick={() => onPreviewChange("offline")}
              >
                {labels.previewOffline}
              </button>
              <button
                type="button"
                aria-pressed={preview === "live"}
                className={segmentClass(preview === "live")}
                onClick={() => onPreviewChange("live")}
              >
                {labels.previewLive}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
