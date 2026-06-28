import { parseFormConfig, type FormConfig, type FormItem, type FormSection, type ScalarType } from "@rfjs/form-builder";

export type Kind = "field" | "content" | "divider" | "spacer" | "ai-note";
export type Component = "Input" | "Textarea" | "Select" | "Number" | "Switch" | "DatePicker";

export interface Card {
  id: string;
  groupId: string;
  kind: Kind;
  label: string;
  key?: string;
  component?: Component;
  required?: boolean;
  placeholder?: string;
  col: number;
  span: number;
  row: number;
}
export interface Group {
  id: string;
  title: string;
  collapsed: boolean;
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

function cardToItem(c: Card): FormItem {
  switch (c.kind) {
    case "field":
      return {
        id: c.id,
        kind: "field",
        key: c.key ?? c.id,
        label: c.label,
        component: c.component ?? "Input",
        dataType: DATATYPE[c.component ?? "Input"],
        ...(c.required ? { required: true } : {}),
        ...(c.placeholder ? { placeholder: c.placeholder } : {}),
      };
    case "content":
      return { id: c.id, kind: "content", text: c.label };
    case "ai-note":
      return { id: c.id, kind: "ai-note", text: c.label };
    case "divider":
      return { id: c.id, kind: "divider" };
    case "spacer":
      return { id: c.id, kind: "spacer" };
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
    for (const item of section.rows.flatMap((r) => r.items)) {
      const p = byId.get(item.id);
      const base = { id: item.id, groupId: section.id, col: p?.colStart ?? 1, span: p?.colSpan ?? 6, row: p?.row ?? 1 };
      if (item.kind === "field") {
        cards.push({ ...base, kind: "field", label: labelToString(item.label), key: item.key, component: item.component as Component, required: item.required, placeholder: item.placeholder });
      } else if (item.kind === "content" || item.kind === "ai-note") {
        cards.push({ ...base, kind: item.kind, label: labelToString(item.text) });
      } else {
        cards.push({ ...base, kind: item.kind, label: item.kind === "divider" ? "Divider" : "Spacer" });
      }
    }
  }
  return { groups, cards };
}

// Parse JSON text → canvas model (throws on invalid FormConfig).
export function jsonToCards(text: string): { groups: Group[]; cards: Card[] } {
  return formConfigToCards(parseFormConfig(JSON.parse(text)));
}
