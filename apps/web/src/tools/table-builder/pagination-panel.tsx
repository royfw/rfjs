"use client";

import * as React from "react";

import type { LocalizedLabel, TablePaginationConfig } from "@rfjs/table-builder";

export interface PaginationPanelLabels {
  title: string;
  pageSize: string;
  emptyText: string;
}

export interface PaginationPanelProps {
  pagination: TablePaginationConfig;
  emptyText?: LocalizedLabel;
  onPaginationChange: (pagination: TablePaginationConfig) => void;
  onEmptyTextChange: (emptyText: string) => void;
  labels: PaginationPanelLabels;
}

function emptyTextToString(emptyText: LocalizedLabel | undefined): string {
  if (emptyText === undefined) return "";
  return typeof emptyText === "string" ? emptyText : (Object.values(emptyText)[0] ?? "");
}

export function PaginationPanel({
  pagination,
  emptyText,
  onPaginationChange,
  onEmptyTextChange,
  labels,
}: PaginationPanelProps) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-semibold">{labels.title}</p>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs">
          <span>{labels.pageSize}</span>
          <input
            type="number"
            min={1}
            value={pagination.pageSize}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (!Number.isFinite(value) || value < 1) return;
              onPaginationChange({ ...pagination, pageSize: value });
            }}
            className="h-7 w-20 rounded-md border border-input bg-transparent px-1.5"
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span>{labels.emptyText}</span>
          <input
            type="text"
            value={emptyTextToString(emptyText)}
            onChange={(e) => onEmptyTextChange(e.target.value)}
            className="h-7 flex-1 rounded-md border border-input bg-transparent px-1.5"
          />
        </label>
      </div>
    </div>
  );
}
