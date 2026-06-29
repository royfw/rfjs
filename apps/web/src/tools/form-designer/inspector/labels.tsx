"use client";
import * as React from "react";
import type { LocalizedLabel } from "@rfjs/form-builder";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

export const LOCALES = ["en", "zh-TW"] as const;

function toRecord(label: LocalizedLabel): Record<string, string> {
  return typeof label === "string" ? { en: label } : { ...label };
}

export function LabelsSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const rec = toRecord(card.label);
  const set = (loc: string, value: string) => {
    const next = { ...rec, [loc]: value };
    if (!value) delete next[loc];
    // collapse to a plain string when only the default locale remains
    const keys = Object.keys(next);
    if (keys.length === 0) { onChange({ label: "" }); return; }
    onChange({ label: keys.length === 1 && keys[0] === "en" ? next.en! : next });
  };
  return (
    <div className="flex flex-col gap-2">
      {LOCALES.map((loc) => (
        <label key={loc} className="flex flex-col gap-1 text-xs text-muted-foreground">
          {loc}
          <input aria-label={loc} className={INPUT_CLS} value={rec[loc] ?? ""} onChange={(e) => set(loc, e.target.value)} />
        </label>
      ))}
    </div>
  );
}
