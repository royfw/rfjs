"use client";

import * as React from "react";

import { parseDataResourceMeta, inferFieldsFromRows } from "@rfjs/data-schema";
import type { DataFieldMeta, DataResourceMeta } from "@rfjs/data-schema";

export interface ImportPanelLabels {
  modeMeta: string;
  modeRows: string;
  placeholderMeta: string;
  placeholderRows: string;
  load: string;
  upload: string;
  invalidJson: string;
  hint: string;
}

export function ImportPanel({
  onMeta,
  onFields,
  labels,
}: {
  onMeta: (meta: DataResourceMeta) => void;
  onFields: (fields: DataFieldMeta[]) => void;
  labels: ImportPanelLabels;
}) {
  const [mode, setMode] = React.useState<"meta" | "rows">("meta");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function segmentClass(active: boolean): string {
    return [
      "rounded-md border px-2 py-1 text-xs",
      active ? "border-primary bg-primary/10 font-medium" : "border-input text-muted-foreground",
    ].join(" ");
  }

  function runLoad(nextText: string) {
    // Parse JSON first
    let parsed: unknown;
    try {
      parsed = JSON.parse(nextText);
    } catch {
      setError(labels.invalidJson);
      return;
    }

    // Handle based on mode
    if (mode === "meta") {
      try {
        const meta = parseDataResourceMeta(parsed);
        setError(null);
        onMeta(meta);
        setText("");
      } catch (err) {
        // Duck-typed zod error handling: read issues[0].message — zod v4's err.message is a
        // JSON array string (first line "["), which must not be shown directly.
        const issues = (err as { issues?: { message?: string }[] }).issues;
        setError(issues?.[0]?.message ?? labels.invalidJson);
      }
    } else {
      // rows mode
      try {
        const fields = inferFieldsFromRows(parsed);
        setError(null);
        onFields(fields);
        setText("");
      } catch (err) {
        // inferFieldsFromRows throws Error objects
        const errMsg = err instanceof Error ? err.message : labels.invalidJson;
        setError(errMsg);
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText(content);
      runLoad(content);
    };
    reader.readAsText(file);
  }

  const placeholder = mode === "meta" ? labels.placeholderMeta : labels.placeholderRows;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <button type="button" className={segmentClass(mode === "meta")} onClick={() => setMode("meta")} aria-pressed={mode === "meta"}>
          {labels.modeMeta}
        </button>
        <button type="button" className={segmentClass(mode === "rows")} onClick={() => setMode("rows")} aria-pressed={mode === "rows"}>
          {labels.modeRows}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-xs"
      />
      <div className="flex items-center gap-2">
        <label className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs text-muted-foreground">
          {labels.upload}
          <input type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </label>
        <button
          type="button"
          className="rounded-md border border-primary px-2 py-1 text-xs font-medium"
          onClick={() => runLoad(text)}
        >
          {labels.load}
        </button>
        <span className="text-xs text-muted-foreground">{labels.hint}</span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
