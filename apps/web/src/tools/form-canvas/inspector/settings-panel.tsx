"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Section } from "./section";
import { OptionsSection } from "./options";
import { ValidationSection } from "./validation";
import { AiNoteSection, ContentSection, SpacerSection } from "./misc-sections";
import { LabelsSection } from "./labels";
import { cardLabel, type Card, type Group, type Component } from "../model";
import { INPUT_CLS } from "./constants";
const COMPONENTS: Component[] = ["Input", "Textarea", "Select", "Number", "Switch", "DatePicker"];
const COLS = 12;

export function SettingsPanel({
  card, groups, onChange, onRemove,
}: { card: Card | null; groups: Group[]; onChange: (p: Partial<Card>) => void; onRemove: () => void }) {
  if (!card) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/20 p-6 text-center text-sm text-muted-foreground">
        Select a card to edit its config
      </div>
    );
  }
  const isField = card.kind === "field";
  return (
    <div className="flex flex-col gap-3">
      <Section title="Basics">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Label
          <input className={INPUT_CLS} value={cardLabel(card.label)} onChange={(e) => onChange({ label: e.target.value })} />
        </label>
        {isField ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Key
              <input className={`${INPUT_CLS} font-mono`} value={card.key ?? ""} onChange={(e) => onChange({ key: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Component
              <select className={INPUT_CLS} value={card.component ?? "Input"} onChange={(e) => onChange({ component: e.target.value as Component })}>
                {COMPONENTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Placeholder
              <input className={INPUT_CLS} value={card.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(card.required)} onChange={(e) => onChange({ required: e.target.checked })} />
              Required
            </label>
          </>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Width (cols)
            <select className={INPUT_CLS} value={card.span} onChange={(e) => onChange({ span: Number(e.target.value) })}>
              {Array.from({ length: COLS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Group
            <select className={INPUT_CLS} value={card.groupId} onChange={(e) => onChange({ groupId: e.target.value })}>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </label>
        </div>
      </Section>

      {isField ? <Section title="Validation" defaultOpen={false}><ValidationSection card={card} onChange={onChange} /></Section> : null}

      {isField && card.component === "Select" ? <Section title="Options" defaultOpen={false}><OptionsSection card={card} onChange={onChange} /></Section> : null}

      {isField ? <Section title="AI Note" defaultOpen={false}><AiNoteSection card={card} onChange={onChange} /></Section> : null}
      {card.kind === "content" ? <Section title="Content"><ContentSection card={card} onChange={onChange} /></Section> : null}
      {card.kind === "spacer" ? <Section title="Spacer"><SpacerSection card={card} onChange={onChange} /></Section> : null}

      {card.kind !== "divider" && card.kind !== "spacer" ? <Section title="Labels (i18n)" defaultOpen={false}><LabelsSection card={card} onChange={onChange} /></Section> : null}

      <button
        type="button"
        onClick={onRemove}
        className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive"
      >
        <Trash2 className="size-3.5" />
        Delete card
      </button>
    </div>
  );
}
