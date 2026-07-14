"use client";

import * as React from "react";

import type { FieldFormat, LocalizedLabel, ScalarType, TableColumnConfig } from "@rfjs/table-builder";
import { SectionCard } from "@/components/shared/section-card";

export interface ColumnsPanelLabels {
  title: string;
  visible: string;
  label: string;
  format: string;
  formatNone: string;
  sortable: string;
  filter: string;
  pin: string;
  pinNone: string;
  pinLeft: string;
  pinRight: string;
}

export interface ColumnsPanelProps {
  columns: TableColumnConfig[];
  onChange: (columns: TableColumnConfig[]) => void;
  labels: ColumnsPanelLabels;
}

// Which `FieldFormat` tokens are valid per `ScalarType` (mirrors the zod superRefine in
// `@rfjs/table-builder`'s schema.ts / `@rfjs/data-schema`'s schema.ts -- kept in sync by hand since
// neither package exports the grouping, only the combined `fieldFormatSchema` enum).
const FORMAT_OPTIONS_BY_TYPE: Record<ScalarType, FieldFormat[]> = {
  string: [],
  boolean: [],
  numeric: ["integer", "decimal", "percent", "currency"],
  date: ["date", "datetime", "time"],
};

function labelToString(label: LocalizedLabel): string {
  return typeof label === "string" ? label : (Object.values(label)[0] ?? "");
}

function pinLabel(pin: TableColumnConfig["pin"], labels: ColumnsPanelLabels): string {
  return pin === "left" ? labels.pinLeft : pin === "right" ? labels.pinRight : labels.pinNone;
}

// Plain `{ ...rest } = column` destructuring to drop a key leaves an intentionally-unused binding
// for the dropped property, which this repo's apps/web eslint config (no `varsIgnorePattern`)
// flags -- an explicit shallow-copy + delete sidesteps that without suppressing the lint rule.
function omitKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

export function ColumnsPanel({ columns, onChange, labels }: ColumnsPanelProps) {
  // Ref (not state): recording which row started the drag must never trigger a re-render --
  // it's read once, synchronously, inside the drop handler of the same gesture.
  const dragIndexRef = React.useRef<number | null>(null);

  function updateAt(index: number, updater: (column: TableColumnConfig) => TableColumnConfig) {
    onChange(columns.map((column, i) => (i === index ? updater(column) : column)));
  }

  function setVisible(index: number, visible: boolean) {
    updateAt(index, (column) => ({ ...column, visible }));
  }

  function setLabel(index: number, label: string) {
    updateAt(index, (column) => ({ ...column, label }));
  }

  function setSortable(index: number, sortable: boolean) {
    updateAt(index, (column) => ({ ...column, sortable }));
  }

  function setFilterable(index: number, filterable: boolean) {
    updateAt(index, (column) => ({ ...column, filterable: filterable || undefined }));
  }

  function setFormat(index: number, format: string) {
    updateAt(index, (column) => {
      const rest = omitKey(column, "format");
      return format === "" ? rest : { ...rest, format: format as FieldFormat };
    });
  }

  function cyclePin(index: number) {
    updateAt(index, (column) => {
      const nextPin: "left" | "right" | undefined =
        column.pin === undefined ? "left" : column.pin === "left" ? "right" : undefined;
      const rest = omitKey(column, "pin");
      return nextPin === undefined ? rest : { ...rest, pin: nextPin };
    });
  }

  function handleDragStart(index: number) {
    return () => {
      dragIndexRef.current = index;
    };
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
  }

  function handleDrop(index: number) {
    return (event: React.DragEvent) => {
      event.preventDefault();
      const from = dragIndexRef.current;
      dragIndexRef.current = null;
      if (from === null || from === index) return;
      const next = [...columns];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(index, 0, moved);
      onChange(next);
    };
  }

  return (
    <SectionCard title={labels.title}>
      <div className="flex flex-col gap-1">
        {columns.map((column, index) => {
          const formatOptions = FORMAT_OPTIONS_BY_TYPE[column.dataType];
          return (
            <div
              key={column.key}
              data-testid={`column-row-${column.key}`}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(index)}
              className="flex flex-wrap items-center gap-2 rounded-md border border-transparent px-1 py-1 text-xs hover:border-input"
            >
              <span className="cursor-grab select-none text-muted-foreground" aria-hidden="true">
                ⠿
              </span>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={column.visible ?? true}
                  onChange={(e) => setVisible(index, e.target.checked)}
                  aria-label={`${labels.visible} ${column.key}`}
                />
                {labels.visible}
              </label>
              <input
                type="text"
                value={labelToString(column.label)}
                onChange={(e) => setLabel(index, e.target.value)}
                aria-label={`${labels.label} ${column.key}`}
                className="h-7 w-28 rounded-md border border-input bg-transparent px-1.5"
              />
              <select
                value={column.format ?? ""}
                onChange={(e) => setFormat(index, e.target.value)}
                disabled={formatOptions.length === 0}
                aria-label={`${labels.format} ${column.key}`}
                className="h-7 rounded-md border border-input bg-transparent px-1.5"
              >
                <option value="">{labels.formatNone}</option>
                {formatOptions.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={column.sortable ?? false}
                  onChange={(e) => setSortable(index, e.target.checked)}
                  aria-label={`${labels.sortable} ${column.key}`}
                />
                {labels.sortable}
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={column.filterable ?? false}
                  onChange={(e) => setFilterable(index, e.target.checked)}
                  aria-label={`${labels.filter} ${column.key}`}
                />
                {labels.filter}
              </label>
              <button
                type="button"
                onClick={() => cyclePin(index)}
                aria-label={`${labels.pin} ${column.key}`}
                className="rounded-md border border-input px-2 py-1"
              >
                {pinLabel(column.pin, labels)}
              </button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
