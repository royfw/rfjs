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

  function runLoad() {
    // Parse JSON first
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
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
        // Duck-typed zod error handling: use err.issues?.[0]?.message to avoid JSON array string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errMsg = (err as any)?.issues?.[0]?.message ?? labels.invalidJson;
        setError(errMsg);
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
          onClick={runLoad}
        >
          {labels.load}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
