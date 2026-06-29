import {
  parseFormConfig,
  type FormConfig, type FormItem, type FormSection, type ScalarType,
  type LocalizedLabel, type FieldOption, type FieldValidation, type ConditionalRule, type DataSource,
} from "@rfjs/form-builder";

export type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";
export type Component = "Input" | "Textarea" | "Select" | "Number" | "Switch" | "DatePicker";

export interface Card {
  id: string;
  groupId: string;
  kind: Kind;
  label: LocalizedLabel;
  key?: string;
  component?: Component;
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: FieldValidation;
  conditional?: ConditionalRule;
  dataSource?: DataSource;
  aiNote?: string;
  locked?: boolean; // content
  size?: "sm" | "md" | "lg"; // spacer
  col: number;
  span: number;
  row: number;
}
export interface Group {
  id: string;
  title: string;
  collapsed: boolean;
}

export function cardLabel(label: LocalizedLabel, locale = "en"): string {
  if (typeof label === "string") return label;
  return label[locale] ?? Object.values(label)[0] ?? "";
}

const CANVAS_COLUMNS = 12;

// Component → engine dataType (controls validation/coercion downstream).
const DATATYPE: Record<Component, ScalarType> = {
  Input: "string",
  Textarea: "string",
  Select: "string",
  Number: "numeric",
  Switch: "boolean",
  DatePicker: "date",
};

// Canvas-supported components — anything outside this set is normalized to "Input" on import.
const CANVAS_COMPONENT_SET = new Set<string>(Object.keys(DATATYPE));

/** Returns the engine dataType for a given component (defaults to "string"). */
export function componentDataType(component?: Component): ScalarType {
  return DATATYPE[component ?? "Input"] ?? "string";
}

function cardToItem(c: Card): FormItem {
  switch (c.kind) {
    case "field":
      return {
        id: c.id, kind: "field", key: c.key ?? c.id, label: c.label,
        component: c.component ?? "Input", dataType: DATATYPE[c.component ?? "Input"] ?? "string",
        ...(c.required ? { required: true } : {}),
        ...(c.placeholder ? { placeholder: c.placeholder } : {}),
        ...(c.defaultValue !== undefined ? { defaultValue: c.defaultValue } : {}),
        ...(c.options ? { options: c.options } : {}),
        ...(c.validation ? { validation: c.validation } : {}),
        ...(c.conditional ? { conditional: c.conditional } : {}),
        ...(c.dataSource ? { dataSource: c.dataSource } : {}),
        ...(c.aiNote ? { aiNote: c.aiNote } : {}),
      };
    case "content":
      return { id: c.id, kind: "content", text: c.label, ...(c.locked ? { locked: true } : {}) };
    case "ai-note":
      return { id: c.id, kind: "ai-note", text: cardLabel(c.label) };
    case "divider":
      return { id: c.id, kind: "divider" };
    case "spacer":
      return { id: c.id, kind: "spacer", ...(c.size ? { size: c.size } : {}) };
  }
}

export function cardsToFormConfig(groups: Group[], cards: Card[]): FormConfig {
  const sections: FormSection[] = groups.map((g) => {
    const groupCards = cards
      .filter((c) => c.groupId === g.id)
      .sort((a, b) => a.row - b.row || a.col - b.col);
    return {
      id: g.id,
      title: g.title,
      rows: [{ id: `${g.id}_row`, items: groupCards.map(cardToItem) }],
      layout: {
        columns: CANVAS_COLUMNS,
        placements: groupCards.map((c) => ({ itemId: c.id, colStart: c.col, colSpan: c.span, row: c.row })),
      },
    };
  });
  return { version: 1, sections };
}

function labelToString(label: unknown): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") return String(Object.values(label as Record<string, string>)[0] ?? "");
  return "";
}

export function formConfigToCards(config: FormConfig): { groups: Group[]; cards: Card[] } {
  const groups: Group[] = [];
  const cards: Card[] = [];
  for (const section of config.sections ?? []) {
    groups.push({ id: section.id, title: labelToString(section.title) || "Section", collapsed: false });
    const byId = new Map((section.layout?.placements ?? []).map((p) => [p.itemId, p]));
    for (const [i, item] of section.rows.flatMap((r) => r.items).entries()) {
      const p = byId.get(item.id);
      const base = { id: item.id, groupId: section.id, col: p?.colStart ?? 1, span: p?.colSpan ?? 6, row: p?.row ?? (i + 1) };
      if (item.kind === "field") {
        const rawComponent = item.component;
        const component = (rawComponent && CANVAS_COMPONENT_SET.has(rawComponent) ? rawComponent : "Input") as Component;
        cards.push({
          ...base, kind: "field", label: item.label, key: item.key, component,
          required: item.required, placeholder: item.placeholder,
          defaultValue: item.defaultValue, options: item.options, validation: item.validation,
          conditional: item.conditional, dataSource: item.dataSource, aiNote: item.aiNote,
        });
      } else if (item.kind === "content") {
        cards.push({ ...base, kind: "content", label: item.text, locked: item.locked });
      } else if (item.kind === "ai-note") {
        cards.push({ ...base, kind: "ai-note", label: item.text });
      } else {
        cards.push({ ...base, kind: item.kind, label: item.kind === "divider" ? "Divider" : "Spacer", ...(item.kind === "spacer" ? { size: item.size } : {}) });
      }
    }
  }
  return { groups, cards };
}

// Parse JSON text → canvas model (throws on invalid FormConfig).
export function jsonToCards(text: string): { groups: Group[]; cards: Card[] } {
  return formConfigToCards(parseFormConfig(JSON.parse(text)));
}
