"use client";
import * as React from "react";
import type { DataSource } from "@rfjs/form-builder";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

const DIALECTS = ["path", "jsonata", "jsonpath"] as const;
const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

export function DataSourceSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const ds = card.dataSource;
  const setUrl = (url: string) => {
    if (!url) return onChange({ dataSource: undefined });
    const next: DataSource = ds ? { ...ds, request: { ...ds.request, url } } : { request: { url }, extract: { dialect: "path", expr: "" } };
    onChange({ dataSource: next });
  };
  const patch = (mut: (d: DataSource) => DataSource) => {
    if (!ds) return;
    onChange({ dataSource: mut(ds) });
  };
  const opt = (key: "optionLabel" | "optionValue" | "fallback", value: string) =>
    patch((d) => { const n = { ...d }; if (value) n[key] = value; else delete n[key]; return n; });
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        URL
        <input aria-label="URL" className={INPUT_CLS} value={ds?.request.url ?? ""} onChange={(e) => setUrl(e.target.value)} />
      </label>
      {ds ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Method
              <select className={INPUT_CLS} value={ds.request.method ?? "GET"} onChange={(e) => patch((d) => ({ ...d, request: { ...d.request, method: e.target.value as DataSource["request"]["method"] } }))}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Dialect
              <select className={INPUT_CLS} value={ds.extract.dialect} onChange={(e) => patch((d) => ({ ...d, extract: { ...d.extract, dialect: e.target.value as DataSource["extract"]["dialect"] } }))}>
                {DIALECTS.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Extract expr
            <input className={`${INPUT_CLS} font-mono`} value={ds.extract.expr} onChange={(e) => patch((d) => ({ ...d, extract: { ...d.extract, expr: e.target.value } }))} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Option label
              <input aria-label="option label" className={INPUT_CLS} value={ds.optionLabel ?? ""} onChange={(e) => opt("optionLabel", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Option value
              <input aria-label="option value" className={INPUT_CLS} value={ds.optionValue ?? ""} onChange={(e) => opt("optionValue", e.target.value)} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Fallback
            <input className={INPUT_CLS} value={ds.fallback ?? ""} onChange={(e) => opt("fallback", e.target.value)} />
          </label>
        </>
      ) : null}
    </div>
  );
}
