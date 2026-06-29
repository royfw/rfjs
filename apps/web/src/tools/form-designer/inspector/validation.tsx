"use client";
import * as React from "react";
import type { FieldValidation } from "@rfjs/form-builder";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

export function ValidationSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  const v = card.validation ?? {};
  const numeric = card.component === "Number";
  const set = (patch: Partial<FieldValidation>) => {
    const next: FieldValidation = { ...v, ...patch };
    // drop keys set back to undefined/empty
    (Object.keys(next) as (keyof FieldValidation)[]).forEach((k) => {
      if (next[k] === undefined || next[k] === "") delete next[k];
    });
    onChange({ validation: Object.keys(next).length ? next : undefined });
  };
  const numField = (key: "min" | "max" | "minLength" | "maxLength", label: string) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="number" className={INPUT_CLS} value={v[key] ?? ""}
        onChange={(e) => set({ [key]: e.target.value === "" ? undefined : Number(e.target.value) } as Partial<FieldValidation>)}
      />
    </label>
  );
  return (
    <div className="grid grid-cols-2 gap-2">
      {numeric ? numField("min", "Min") : numField("minLength", "Min length")}
      {numeric ? numField("max", "Max") : numField("maxLength", "Max length")}
      {!numeric ? (
        <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
          Pattern (regex)
          <input className={`${INPUT_CLS} font-mono`} value={v.pattern ?? ""} onChange={(e) => set({ pattern: e.target.value || undefined })} />
        </label>
      ) : null}
      <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground">
        Error message
        <input className={INPUT_CLS} value={v.message ?? ""} onChange={(e) => set({ message: e.target.value || undefined })} />
      </label>
    </div>
  );
}
