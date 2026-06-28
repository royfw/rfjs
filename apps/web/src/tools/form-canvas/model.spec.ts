import { describe, it, expect } from "vitest";
import { cardsToFormConfig, formConfigToCards, type Card, type Group } from "./model";

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
