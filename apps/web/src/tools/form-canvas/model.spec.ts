import { describe, it, expect } from "vitest";
import { cardsToFormConfig, formConfigToCards, type Card, type Group } from "./model";
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
  it("normalizes an unsupported component (Checkbox) to Input and round-trips with a defined dataType", () => {
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
                // "Checkbox" is valid in form-builder but not in the canvas Component union
                { id: "f1", kind: "field", key: "agree", label: "Agree", component: "Checkbox" as never, dataType: "boolean" },
              ],
            },
          ],
        },
      ],
    };
    const { cards } = formConfigToCards(config);
    expect(cards[0]?.component).toBe("Input"); // normalized
    const cfg = cardsToFormConfig([{ id: "s1", title: "Section", collapsed: false }], cards);
    const item = cfg.sections![0]!.rows[0]!.items[0]!;
    expect("dataType" in item && (item as { dataType?: unknown }).dataType).toBeDefined();
    expect((item as { dataType?: unknown }).dataType).toBe("string");
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
