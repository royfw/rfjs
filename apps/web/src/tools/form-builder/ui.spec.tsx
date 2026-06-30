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
import { FormBuilderTool } from "./ui";
import { resolveCards, collides, type PlacedCard } from "./layout-grid";

describe("FormBuilderTool preview", () => {
  it("Preview tab renders the real ConfigForm with a labelled control", () => {
    render(<FormBuilderTool />);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    // The seed has a "Name" field → real <Label> + a real input render.
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByRole("button", { name: /submit/i })).toBeTruthy();
  });

  it("JSON tab shows a FormConfig (version + sections)", () => {
    render(<FormBuilderTool />);
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

describe("FormBuilderTool drag threshold", () => {
  it("a sub-threshold pointer move (a click) does not move the card", () => {
    render(<FormBuilderTool />);
    const card = screen.getByText("Name").closest(".cursor-grab") as HTMLElement;
    const before = card.style.gridColumn;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 102, clientY: 101 }); // ~2px, below the 4px threshold
    fireEvent.pointerUp(window, { clientX: 102, clientY: 101 });
    expect(card.style.gridColumn).toBe(before);
  });
});

describe("FormBuilderTool group reorder", () => {
  it("each group has a reorder handle", () => {
    render(<FormBuilderTool />);
    expect(screen.getAllByRole("button", { name: /reorder group/i }).length).toBeGreaterThanOrEqual(2);
  });
});

describe("FormBuilderTool canvas collapsible sections", () => {
  it("Canvas tab has two independent collapsible sections: Editor and Live Preview", () => {
    render(<FormBuilderTool />);
    // Canvas is the default tab — both section headers should be present
    expect(screen.getByRole("button", { name: /editor/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /live preview/i })).toBeTruthy();
    // Live Preview is collapsed by default: Mobile preset button is inside its content → not in DOM
    expect(screen.queryByRole("button", { name: /^mobile$/i })).toBeNull();
  });
});

describe("FormBuilderTool preview tab integration", () => {
  it("Preview tab renders ResponsivePreview with device controls + a submission panel", () => {
    render(<FormBuilderTool />);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    // Device preset buttons from ResponsivePreview
    expect(screen.getByRole("button", { name: /^mobile$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^tablet$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^desktop$/i })).toBeTruthy();
    // SubmissionPanel is mounted inside a collapsed "Submission" section —
    // the section toggle button is always present even when collapsed.
    expect(screen.getByRole("button", { name: /submission/i })).toBeTruthy();
  });

  it("Preview tab uses vertical stack layout (no lg:flex-row)", () => {
    render(<FormBuilderTool />);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    // The preview tab wrapper must NOT have lg:flex-row — find the rp-frame and walk up
    const frame = screen.getByTestId("rp-frame");
    // Walk up to the direct parent of ResponsivePreview root and check no lg:flex-row in the chain
    let el: HTMLElement | null = frame.parentElement;
    let foundFlexRow = false;
    while (el && !el.classList.contains("form-builder-root")) {
      if (el.className.includes("lg:flex-row")) {
        foundFlexRow = true;
        break;
      }
      el = el.parentElement;
    }
    expect(foundFlexRow).toBe(false);
  });

  it("Preview tab wraps SubmissionPanel in a collapsible Submission section (collapsed by default)", () => {
    render(<FormBuilderTool />);
    fireEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    // "Submission" section header should be present
    expect(screen.getByRole("button", { name: /submission/i })).toBeTruthy();
    // Section is collapsed by default: the inner panel content (Metadata heading) is NOT in the DOM
    expect(screen.queryByText(/^metadata$/i)).toBeNull();
  });
});

describe("FormBuilderTool mobile config overlay (does not block canvas drag)", () => {
  // The inspector container uses the full-screen overlay classes on mobile only
  // when the mobile config is open. A press-to-drag must NOT open it.
  const isOverlayOpen = () => screen.getByTestId("card-inspector").className.includes("fixed");

  it("a tap (press-release without moving) opens the mobile config overlay", () => {
    render(<FormBuilderTool />);
    const card = screen.getByText("Name").closest(".cursor-grab") as HTMLElement;
    expect(isOverlayOpen()).toBe(false);
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    expect(isOverlayOpen()).toBe(false); // still closed mid-press → canvas not covered
    fireEvent.pointerUp(window, { clientX: 100, clientY: 100 }); // no movement → a tap
    expect(isOverlayOpen()).toBe(true);
  });

  it("a press-drag (past the threshold) does NOT open the overlay, so the canvas stays draggable", () => {
    render(<FormBuilderTool />);
    const card = screen.getByText("Name").closest(".cursor-grab") as HTMLElement;
    fireEvent.pointerDown(card, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 140, clientY: 140 }); // ~57px, past the 4px threshold → a drag
    fireEvent.pointerUp(window, { clientX: 140, clientY: 140 });
    expect(isOverlayOpen()).toBe(false);
  });
});
