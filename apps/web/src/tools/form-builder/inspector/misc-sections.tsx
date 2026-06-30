"use client";
import * as React from "react";
import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

export function AiNoteSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      AI note (not shown to fillers)
      <textarea className={`${INPUT_CLS} h-16 py-1.5`} value={card.aiNote ?? ""} onChange={(e) => onChange({ aiNote: e.target.value || undefined })} />
    </label>
  );
}

export function ContentSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={Boolean(card.locked)} onChange={(e) => onChange({ locked: e.target.checked || undefined })} />
      Locked (preset, not editable by filler)
    </label>
  );
}

export function SpacerSection({ card, onChange }: { card: Card; onChange: (p: Partial<Card>) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      Size
      <select className={INPUT_CLS} value={card.size ?? "md"} onChange={(e) => onChange({ size: e.target.value as "sm" | "md" | "lg" })}>
        <option value="sm">sm</option>
        <option value="md">md</option>
        <option value="lg">lg</option>
      </select>
    </label>
  );
}
