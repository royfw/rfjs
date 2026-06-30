"use client";

import * as React from "react";
import type { SubmissionMeta } from "@rfjs/form-builder-ui";
import { cn } from "@rfjs/web-ui/lib/utils";

// ---------------------------------------------------------------------------
// SubmissionPanel
// Displays submission payload (data + meta) or an empty state when null.
// ---------------------------------------------------------------------------

export interface SubmissionPanelProps {
  payload: { data: Record<string, unknown>; meta: SubmissionMeta } | null;
  compact?: boolean;
}

export function SubmissionPanel({ payload, compact = false }: SubmissionPanelProps): JSX.Element {
  if (payload === null) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-4",
          compact && "p-2",
        )}
      >
        <p className={cn("text-sm text-muted-foreground", compact && "text-xs")}>
          Fill the form
        </p>
      </div>
    );
  }

  const { data, meta } = payload;
  const { valid, errors, visibleKeys, schemaVersion } = meta;

  return (
    <div className={cn("flex flex-col gap-4", compact && "gap-2")}>
      {/* Metadata Block */}
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-4",
          compact && "p-3",
        )}
      >
        <h3 className={cn("mb-3 font-semibold text-foreground", compact && "mb-2 text-sm")}>
          Metadata
        </h3>

        {/* Valid Badge */}
        <div className={cn("flex items-center gap-2", compact && "mb-2")}>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              valid
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
            )}
          >
            {valid ? "Valid" : "Invalid"}
          </span>
        </div>

        {/* Errors List */}
        {Object.keys(errors).length > 0 && (
          <div className={cn("mb-3 space-y-1", compact && "mb-2 space-y-0.5")}>
            <p className="text-xs font-medium text-muted-foreground">Errors:</p>
            <ul className="space-y-0.5 text-xs">
              {Object.entries(errors).map(([key, error]) => (
                <li key={key} className="text-red-600 dark:text-red-400">
                  <span className="font-mono font-medium">{key}</span>: {error}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Visible Keys */}
        {visibleKeys.length > 0 && (
          <div className={cn("mb-3 space-y-1", compact && "mb-2 space-y-0.5")}>
            <p className="text-xs font-medium text-muted-foreground">Visible Keys:</p>
            <p className={cn("font-mono text-xs text-foreground", compact && "text-[11px]")}>
              {visibleKeys.join(", ")}
            </p>
          </div>
        )}

        {/* Schema Version */}
        {schemaVersion !== undefined && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Schema Version:</p>
            <p className={cn("font-mono text-xs text-foreground", compact && "text-[11px]")}>
              {schemaVersion}
            </p>
          </div>
        )}
      </div>

      {/* Data Block */}
      <div
        className={cn(
          "rounded-lg border border-border bg-card p-4",
          compact && "p-3",
        )}
      >
        <h3 className={cn("mb-3 font-semibold text-foreground", compact && "mb-2 text-sm")}>
          Data
        </h3>
        <pre
          className={cn(
            "overflow-auto rounded bg-muted p-2 font-mono text-xs text-foreground",
            compact && "text-[10px]",
          )}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}
