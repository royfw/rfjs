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
