"use client";
import * as React from "react";
import { Trash2 } from "lucide-react";
import { Section } from "./section";
import { OptionsSection } from "./options";
import { ValidationSection } from "./validation";
import { AiNoteSection, ContentSection, SpacerSection } from "./misc-sections";
import { LabelsSection } from "./labels";
import { ConditionalSection } from "./conditional";
import { DataSourceSection } from "./data-source";
import { cardLabel, type Card, type Group, type Component } from "../model";
import { INPUT_CLS } from "./constants";

const COMPONENTS: Component[] = [
  "Input", "Textarea", "Number", "Email",
  "Select", "Radio", "Checkbox", "CheckboxGroup", "TagList",
  "Switch", "Date", "DatePicker",
];

// Components that show the Options editor and/or Data Source section.
const OPTIONS_COMPONENTS = new Set<Component>(["Select", "Radio", "CheckboxGroup", "TagList"]);
const DATASOURCE_COMPONENTS = new Set<Component>(["Select", "Radio", "CheckboxGroup", "TagList"]);

const COLS = 12;

// "Has content" indicators shown on section headers.
const Dot = () => <span className="size-1.5 rounded-full bg-[#5b8cff]" aria-label="has content" />;
const Count = ({ n }: { n: number }) => (
  <span className="rounded-full bg-[#5b8cff]/15 px-1.5 text-[10px] font-medium text-[#5b8cff]">{n}</span>
);

export function SettingsPanel({
  card, groups, onChange, onRemove, siblingFields = [],
}: { card: Card | null; groups: Group[]; onChange: (p: Partial<Card>) => void; onRemove: () => void; siblingFields?: { key: string; dataType: string }[] }) {
  if (!card) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/20 p-6 text-center text-sm text-muted-foreground">
        Select a card to edit its config
      </div>
    );
  }
  const isField = card.kind === "field";
  const comp = card.component;
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
              Description
              <input className={INPUT_CLS} value={cardLabel(card.description ?? "")} onChange={(e) => onChange({ description: e.target.value || undefined })} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Placeholder
              <input className={INPUT_CLS} value={card.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(card.required)} onChange={(e) => onChange({ required: e.target.checked || undefined })} />
              Required
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(card.disabled)} onChange={(e) => onChange({ disabled: e.target.checked || undefined })} />
              Disabled
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={Boolean(card.readOnly)} onChange={(e) => onChange({ readOnly: e.target.checked || undefined })} />
              Read-only
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

      {/* Common config: expanded by default. Advanced: collapsed with a "has content" badge. */}
      {isField ? (
        <Section title="Validation" badge={card.validation && Object.keys(card.validation).length ? <Count n={Object.keys(card.validation).length} /> : undefined}>
          <ValidationSection card={card} onChange={onChange} />
        </Section>
      ) : null}

      {isField && comp && OPTIONS_COMPONENTS.has(comp) ? (
        <Section title="Options" badge={card.options?.length ? <Count n={card.options.length} /> : undefined}>
          <OptionsSection card={card} onChange={onChange} />
        </Section>
      ) : null}

      {isField ? (
        <Section title="Conditional" badge={card.conditional ? <Dot /> : undefined}>
          <ConditionalSection card={card} siblingFields={siblingFields} onChange={onChange} />
        </Section>
      ) : null}

      {isField && comp && DATASOURCE_COMPONENTS.has(comp) ? (
        <Section title="Data Source" defaultOpen={false} badge={card.dataSource ? <Dot /> : undefined}>
          <DataSourceSection card={card} onChange={onChange} />
        </Section>
      ) : null}

      {isField ? (
        <Section title="AI Note" defaultOpen={false} badge={card.aiNote ? <Dot /> : undefined}>
          <AiNoteSection card={card} onChange={onChange} />
        </Section>
      ) : null}

      {card.kind === "content" ? <Section title="Content"><ContentSection card={card} onChange={onChange} /></Section> : null}
      {card.kind === "spacer" ? <Section title="Spacer"><SpacerSection card={card} onChange={onChange} /></Section> : null}

      {(card.kind === "field" || card.kind === "content") ? (
        <Section title="Labels (i18n)" defaultOpen={false} badge={typeof card.label === "object" ? <Dot /> : undefined}>
          <LabelsSection card={card} onChange={onChange} />
        </Section>
      ) : null}

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
