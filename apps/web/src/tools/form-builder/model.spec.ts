import { describe, it, expect } from "vitest";
import { cardsToFormConfig, formConfigToCards, cardLabel, type Card, type Group } from "./model";
import type { FormConfig } from "@rfjs/form-builder";

const groups: Group[] = [{ id: "g1", title: "Account", collapsed: false }];
const cards: Card[] = [
  { id: "c1", groupId: "g1", kind: "field", label: "Name", key: "name", component: "Input", required: true, col: 1, span: 7, row: 1 },
  { id: "c2", groupId: "g1", kind: "field", label: "Age", key: "age", component: "Number", col: 8, span: 5, row: 1 },
];

describe("canvas <-> FormConfig", () => {
  it("emits a FormConfig whose section.layout keeps exact col/span/row", () => {
    const cfg = cardsToFormConfig(groups, cards);
    expect(cfg.sections![0]!.layout).toEqual({
      columns: 12,
      placements: [
        { itemId: "c1", colStart: 1, colSpan: 7, row: 1 },
        { itemId: "c2", colStart: 8, colSpan: 5, row: 1 },
      ],
    });
    expect(cfg.sections![0]!.rows[0]!.items[1]).toMatchObject({ key: "age", component: "Number", dataType: "numeric" });
  });

  it("round-trips canvas -> FormConfig -> canvas without losing placement", () => {
    const back = formConfigToCards(cardsToFormConfig(groups, cards));
    expect(back.cards).toHaveLength(2);
    expect(back.cards[1]).toMatchObject({ id: "c2", col: 8, span: 5, row: 1, component: "Number" });
  });
});

describe("formConfigToCards — import guards", () => {
  it("preserves Checkbox (now a first-class component) and round-trips with dataType boolean", () => {
    const config: FormConfig = {
      version: 1,
      sections: [
        {
          id: "s1",
          title: "Section",
          rows: [
            {
              id: "r1",
              items: [
                // "Checkbox" is now valid in the canvas Component union
                { id: "f1", kind: "field", key: "agree", label: "Agree", component: "Checkbox", dataType: "boolean" },
              ],
            },
          ],
        },
      ],
    };
    const { cards } = formConfigToCards(config);
    expect(cards[0]?.component).toBe("Checkbox"); // preserved, not normalized
    const cfg = cardsToFormConfig([{ id: "s1", title: "Section", collapsed: false }], cards);
    const item = cfg.sections![0]!.rows[0]!.items[0]!;
    expect("dataType" in item && (item as { dataType?: unknown }).dataType).toBeDefined();
    expect((item as { dataType?: unknown }).dataType).toBe("boolean");
  });

  it("assigns distinct rows (index-based) when no layout.placements present", () => {
    const config: FormConfig = {
      version: 1,
      sections: [
        {
          id: "s1",
          title: "Section",
          rows: [
            {
              id: "r1",
              items: [
                { id: "f1", kind: "field", key: "a", label: "A", component: "Input", dataType: "string" },
                { id: "f2", kind: "field", key: "b", label: "B", component: "Input", dataType: "string" },
              ],
            },
          ],
          // no layout — simulates a plain flow config pasted in
        },
      ],
    };
    const { cards } = formConfigToCards(config);
    expect(cards[0]?.row).toBe(1);
    expect(cards[1]?.row).toBe(2);
    expect(cards[0]?.row).not.toBe(cards[1]?.row);
  });
});

describe("new components + new field props round-trip", () => {
  it("round-trips CheckboxGroup/Radio/Date + description/disabled/readOnly without losing data", () => {
    const cfg = {
      version: 1,
      sections: [{ id: "s", title: "S", rows: [{ id: "r", items: [
        { id: "g", key: "g", label: "G", kind: "field", component: "CheckboxGroup", dataType: "array",
          options: [{ label: "A", value: "a" }], description: "d", readOnly: true },
        { id: "d", key: "d", label: "D", kind: "field", component: "Date", dataType: "date" },
      ] }] }],
    };
    const { groups: g, cards: cs } = formConfigToCards(cfg as FormConfig);
    const back = cardsToFormConfig(g, cs);
    const item0 = back.sections![0]!.rows[0]!.items[0]!;
    expect((item0 as { component?: unknown }).component).toBe("CheckboxGroup"); // not normalized to Input
    expect((item0 as { description?: unknown }).description).toBe("d");
    expect((item0 as { readOnly?: unknown }).readOnly).toBe(true);
  });
});

describe("full-config round-trip", () => {
  const groups: Group[] = [{ id: "g1", title: "G", collapsed: false }];
  const rich: Card = {
    id: "f1", groupId: "g1", kind: "field", label: { en: "Email", "zh-TW": "電郵" },
    key: "email", component: "Select", required: true, placeholder: "pick",
    defaultValue: "a", options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
    validation: { minLength: 2, pattern: "^.+$", message: "bad" },
    conditional: { logic: "and", filters: [{ field: "role", dataType: "string", operator: "eq", value: "admin" }] },
    dataSource: { request: { url: "/api/x" }, extract: { dialect: "path", expr: "data" }, optionLabel: "name", optionValue: "id" },
    aiNote: "fill carefully", col: 1, span: 6, row: 1,
  };
  it("round-trips every field through FormConfig", () => {
    const back = formConfigToCards(cardsToFormConfig(groups, [rich])).cards[0]!;
    expect(back.label).toEqual({ en: "Email", "zh-TW": "電郵" });
    expect(back.required).toBe(true);
    expect(back.defaultValue).toBe("a");
    expect(back.options).toEqual([{ label: "A", value: "a" }, { label: "B", value: "b" }]);
    expect(back.validation).toEqual({ minLength: 2, pattern: "^.+$", message: "bad" });
    expect(back.conditional!.logic).toBe("and");
    expect(back.dataSource!.request.url).toBe("/api/x");
    expect(back.aiNote).toBe("fill carefully");
  });
  it("round-trips content locked + spacer size", () => {
    const cards: Card[] = [
      { id: "c1", groupId: "g1", kind: "content", label: "Hi", locked: true, col: 1, span: 12, row: 1 },
      { id: "s1", groupId: "g1", kind: "spacer", label: "Spacer", size: "lg", col: 1, span: 12, row: 2 },
    ];
    const back = formConfigToCards(cardsToFormConfig(groups, cards)).cards;
    expect(back.find((c) => c.id === "c1")!.locked).toBe(true);
    expect(back.find((c) => c.id === "s1")!.size).toBe("lg");
  });
  it("cardLabel resolves localized + string labels", () => {
    expect(cardLabel({ en: "Hi", "zh-TW": "嗨" }, "zh-TW")).toBe("嗨");
    expect(cardLabel("Plain", "en")).toBe("Plain");
    expect(cardLabel({ "zh-TW": "嗨" }, "en")).toBe("嗨"); // falls back to first value
  });
});

describe("formConfigToCards — flat fields[] config (AI nl-assist output shape)", () => {
  it("normalizes a top-level fields[] config into a single default section", () => {
    const config: FormConfig = {
      version: 1,
      fields: [{ key: "name", label: "Name", component: "Input", dataType: "string" }],
    };
    const { groups: g, cards: cs } = formConfigToCards(config);
    expect(g).toHaveLength(1);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ groupId: g[0]!.id, key: "name", component: "Input" });
  });
});

describe("FileUpload / Signature round-trip", () => {
  it("round-trips FileUpload config (accept/multiple/maxSize) and Signature", () => {
    const cfg = { sections: [{ id: "s", title: "S", rows: [{ id: "r", items: [
      { id: "fu", key: "f", kind: "field", label: "F", component: "FileUpload", dataType: "object", fileUpload: { accept: "image/*", multiple: true, maxSize: 1000 } },
      { id: "sig", key: "s", kind: "field", label: "S", component: "Signature", dataType: "string" },
    ] }] }] };
    const { groups: g, cards: cs } = formConfigToCards(cfg as unknown as FormConfig);
    const back = cardsToFormConfig(g, cs);
    const items = back.sections![0]!.rows[0]!.items;
    expect((items[0] as { component?: string }).component).toBe("FileUpload");
    expect((items[0] as { fileUpload?: unknown }).fileUpload).toEqual({ accept: "image/*", multiple: true, maxSize: 1000 });
    expect((items[1] as { component?: string }).component).toBe("Signature");
  });
});

describe("button cards", () => {
  it("round-trips a button card through FormConfig", () => {
    const groups = [{ id: "g1", title: "G", collapsed: false }];
    const cards = [{
      id: "b1", groupId: "g1", kind: "button" as const, label: "Save draft",
      action: { type: "custom" as const, name: "save-draft" }, buttonVariant: "outline" as const, validate: true,
      col: 1, span: 3, row: 1,
    }];
    const config = cardsToFormConfig(groups, cards);
    const item = config.sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: "button", label: "Save draft", action: { type: "custom", name: "save-draft" }, variant: "outline", validate: true });
    const back = formConfigToCards(config);
    expect(back.cards[0]).toMatchObject({ kind: "button", action: { type: "custom", name: "save-draft" }, buttonVariant: "outline", validate: true });
  });

  it("button card without explicit action defaults to custom", () => {
    const groups = [{ id: "g1", title: "G", collapsed: false }];
    const cards = [{ id: "b1", groupId: "g1", kind: "button" as const, label: "Button", col: 1, span: 3, row: 1 }];
    const item = cardsToFormConfig(groups, cards).sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: "button", action: { type: "custom", name: "action-1" } });
  });
});

describe('result cards', () => {
  it('round-trips a result card through FormConfig', () => {
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [{
      id: 'res1', groupId: 'g1', kind: 'result' as const, label: 'Result',
      mode: 'card' as const, sourceId: 'btn1', dataPath: 'data.items', maxItems: 5, emptyText: 'Nothing',
      col: 1, span: 12, row: 1,
    }];
    const config = cardsToFormConfig(groups, cards);
    const item = config.sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: 'result', mode: 'card', sourceId: 'btn1', dataPath: 'data.items', maxItems: 5, emptyText: 'Nothing' });
    const back = formConfigToCards(config);
    expect(back.cards[0]).toMatchObject({ kind: 'result', mode: 'card', sourceId: 'btn1', dataPath: 'data.items', maxItems: 5, emptyText: 'Nothing' });
  });

  it('result card without mode defaults to json', () => {
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [{ id: 'res1', groupId: 'g1', kind: 'result' as const, label: 'Result', col: 1, span: 12, row: 1 }];
    const item = cardsToFormConfig(groups, cards).sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: 'result', mode: 'json' });
  });

  it('round-trips a table-mode result item with a TableConfig', () => {
    const table = {
      columns: [{ key: 'name', label: 'Name', dataType: 'string' as const }],
      pagination: { pageSize: 10 },
    };
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [
      { id: 'res', groupId: 'g1', kind: 'result' as const, label: 'Result', mode: 'table' as const,
        resultTable: table, col: 1, span: 6, row: 1 },
    ];
    const config = cardsToFormConfig(groups, cards);
    const back = formConfigToCards(config);
    const res = back.cards.find((c) => c.id === 'res');
    expect(res?.mode).toBe('table');
    expect(res?.resultTable).toEqual(table);
  });
});
