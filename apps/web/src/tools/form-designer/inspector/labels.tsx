"use client";
import * as React from "react";
import type { LocalizedLabel } from "@rfjs/form-builder";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

export const LOCALES = ["en", "zh-TW"] as const;

function toRecord(label: LocalizedLabel): Record<string, string> {
  return typeof label === "string" ? { en: label } : { ...label };
}

function applyLocale(rec: Record<string, string>, loc: string, value: string): Record<string, string> | null {
  const next = { ...rec, [loc]: value };
  if (!value) delete next[loc];
  return Object.keys(next).length === 0 ? null : next;
}

function toLocalized(rec: Record<string, string>): LocalizedLabel {
  const keys = Object.keys(rec);
  return keys.length === 1 && keys[0] === "en" ? rec.en! : rec;
}

export function LabelsSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const labelRec = toRecord(card.label);
  const descRec = card.description ? toRecord(card.description) : {};
  const isField = card.kind === "field";

  const setLabel = (loc: string, value: string) => {
    const next = applyLocale(labelRec, loc, value);
    onChange({ label: next ? toLocalized(next) : "" });
  };

  const setDesc = (loc: string, value: string) => {
    const next = applyLocale(descRec, loc, value);
    onChange({ description: next ? toLocalized(next) : undefined });
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">Label</p>
      {LOCALES.map((loc) => (
        <label key={loc} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {loc}
          <input aria-label={`label ${loc}`} className={INPUT_CLS} value={labelRec[loc] ?? ""} onChange={(e) => setLabel(loc, e.target.value)} />
        </label>
      ))}
      {isField ? (
        <>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">Description</p>
          {LOCALES.map((loc) => (
            <label key={loc} className="flex flex-col gap-1 text-xs text-muted-foreground">
              {loc}
              <input aria-label={`description ${loc}`} className={INPUT_CLS} value={descRec[loc] ?? ""} onChange={(e) => setDesc(loc, e.target.value)} />
            </label>
          ))}
        </>
      ) : null}
    </div>
  );
}
