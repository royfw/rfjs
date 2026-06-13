import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Seam } from "./seam";

describe("Seam", () => {
  it("renders the operation label in a chip", () => {
    render(<Seam state="current" operation="flatten()" />);
    expect(screen.getByText(/flatten\(\)/)).toBeDefined();
  });

  it("exposes state via data-state for style + tests (not color alone)", () => {
    const { container } = render(<Seam state="stale" operation="flatten()" />);
    expect(container.querySelector('[data-state="stale"]')).not.toBeNull();
  });

  it("shows an ERR chip when state is error", () => {
    render(<Seam state="error" operation="flatten()" />);
    expect(screen.getByText("ERR")).toBeDefined();
  });

  it("marks the decorative rule aria-hidden", () => {
    const { container } = render(<Seam state="current" operation="flatten()" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
