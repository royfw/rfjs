"use client";

import * as React from "react";

import type { SourceMode } from "./sample";

export interface SourcePanelLabels {
  title: string;
  rows: string;
  fetcher: string;
  offset: string;
  page: string;
  cursor: string;
}

export interface SourcePanelProps {
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  labels: SourcePanelLabels;
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

export function SourcePanel({ mode, onModeChange, labels }: SourcePanelProps) {
  const isRemote = mode !== "rows";

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
      </div>
    </div>
  );
}
