// jsdom shim: radix-ui Select uses pointer capture and scrollIntoView APIs not available in jsdom
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormCanvasTool } from "./ui";
import { resolveCards, collides, type PlacedCard } from "./layout-grid";

describe("FormCanvasTool preview", () => {
  it("Preview tab renders the real ConfigForm with a labelled control", () => {
    render(<FormCanvasTool />);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    // The seed has a "Name" field → real <Label> + a real input render.
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByRole("button", { name: /submit/i })).toBeTruthy();
  });

  it("JSON tab shows a FormConfig (version + sections)", () => {
    render(<FormCanvasTool />);
    fireEvent.click(screen.getByRole("button", { name: /^json$/i }));
    const ta = screen.getByLabelText(/config json/i) as HTMLTextAreaElement;
    const parsed = JSON.parse(ta.value);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.sections)).toBe(true);
    expect(parsed.sections[0].layout.columns).toBe(12);
  });
});

describe("canvas no-overlap invariant", () => {
  it("resolveCards leaves no two cards in a group sharing a cell after a colliding move", () => {
    const cards: PlacedCard[] = [
      { id: "a", groupId: "g1", col: 1, span: 6, row: 1 },
      { id: "b", groupId: "g1", col: 1, span: 6, row: 1 }, // a and b dropped on the same cell
      { id: "c", groupId: "g1", col: 7, span: 6, row: 1 },
    ];
    const out = resolveCards(cards, "a", 12);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++)
        if (out[i]!.groupId === out[j]!.groupId) expect(collides(out[i]!, out[j]!)).toBe(false);
  });
});
