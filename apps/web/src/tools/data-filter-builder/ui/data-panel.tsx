"use client";

import { Button } from "@rfjs/web-ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rfjs/web-ui/components/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { CanonicalEditor } from "@/tools/_filter-builder";

export interface DataPanelLabels {
  data: string;
  counts: string;
  raw: string;
  matched: string;
  json: string;
  empty: string;
  canonicalHint: string;
  copy: string;
}

type Tab = "matched" | "raw" | "json";

type Row = Record<string, unknown>;

function asRows(rows: unknown[]): Row[] {
  return rows.filter((r): r is Row => typeof r === "object" && r !== null && !Array.isArray(r));
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function RowsTable({ rows, empty }: { rows: Row[]; empty: string }) {
  const cols = Object.keys(rows[0] ?? {});
  if (rows.length === 0 || cols.length === 0) {
    return <p className="font-mono text-xs text-muted-foreground">{empty}</p>;
  }
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          {cols.map((c) => (
            <TableHead key={c} className="font-mono text-xs">
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={i}>
            {cols.map((c) => (
              <TableCell key={c} className="truncate font-mono text-xs">
                {cell(row[c])}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function DataPanel({
  rows,
  matched,
  canonicalJson,
  onCanonicalChange,
  aiRow,
  error,
  labels,
}: {
  rows: unknown[];
  matched: unknown[];
  canonicalJson: string;
  onCanonicalChange: (text: string) => void;
  /** Optional row rendered directly above the canonical editor (e.g. <AiNlRow>). */
  aiRow?: ReactNode;
  error: string | null;
  labels: DataPanelLabels;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("matched");

  const counts = labels.counts
    .replace("{raw}", String(rows.length))
    .replace("{matched}", String(matched.length));

  return (
    <section className="rounded-lg border bg-card text-card-foreground">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {labels.data}
          </span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">{counts}</span>
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border-t p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="xs"
              variant={tab === "matched" ? "default" : "outline"}
              onClick={() => setTab("matched")}
            >
              {labels.matched}
            </Button>
            <Button
              type="button"
              size="xs"
              variant={tab === "raw" ? "default" : "outline"}
              onClick={() => setTab("raw")}
            >
              {labels.raw}
            </Button>
            <Button
              type="button"
              size="xs"
              variant={tab === "json" ? "default" : "outline"}
              onClick={() => setTab("json")}
            >
              {labels.json}
            </Button>
          </div>

          {tab === "matched" ? <RowsTable rows={asRows(matched)} empty={labels.empty} /> : null}
          {tab === "raw" ? <RowsTable rows={asRows(rows)} empty={labels.empty} /> : null}
          {tab === "json" ? (
            <div className="flex flex-col gap-3">
              {aiRow}
              <CanonicalEditor
                value={canonicalJson}
                onChange={onCanonicalChange}
                error={error}
                labels={{ canonicalHint: labels.canonicalHint, copy: labels.copy }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
