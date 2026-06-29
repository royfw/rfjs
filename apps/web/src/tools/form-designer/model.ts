import {
  parseFormConfig,
  type FieldComponent, type FieldType,
  type FormConfig, type FormItem, type FormSection,
  type LocalizedLabel, type FieldOption, type FieldValidation, type ConditionalRule, type DataSource,
} from "@rfjs/form-builder";

export type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";
// Canvas Component = full engine FieldComponent union.
export type Component = FieldComponent;

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
  description?: LocalizedLabel;
  disabled?: boolean;
  readOnly?: boolean;
  creatable?: boolean;
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
const DATATYPE: Record<Component, FieldType> = {
  Input: "string",
  Textarea: "string",
  Select: "string",
  Checkbox: "boolean",
  Date: "date",
  Number: "numeric",
  Email: "string",
  Switch: "boolean",
  Radio: "string",
  DatePicker: "date",
  CheckboxGroup: "array",
  TagList: "array",
};

/** Returns the engine dataType for a given component (defaults to "string"). */
export function componentDataType(component?: Component): FieldType {
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
        ...(c.description ? { description: c.description } : {}),
        ...(c.disabled ? { disabled: c.disabled } : {}),
        ...(c.readOnly ? { readOnly: c.readOnly } : {}),
        ...(c.creatable ? { creatable: c.creatable } : {}),
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
        cards.push({
          ...base, kind: "field", label: item.label, key: item.key, component: item.component as Component,
          required: item.required, placeholder: item.placeholder,
          defaultValue: item.defaultValue, options: item.options, validation: item.validation,
          conditional: item.conditional, dataSource: item.dataSource,
          description: item.description, disabled: item.disabled, readOnly: item.readOnly, creatable: item.creatable,
          aiNote: item.aiNote,
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
