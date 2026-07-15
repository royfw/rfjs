import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OptionsSection } from "./options";
import type { Card } from "../model";

const sel: Card = { id: "f", groupId: "g", kind: "field", label: "Role", key: "role", component: "Select", options: [{ label: "Admin", value: "admin" }], col: 1, span: 6, row: 1 };

describe("OptionsSection", () => {
  it("adds an option row", () => {
    const onChange = vi.fn();
    render(<OptionsSection card={sel} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add option/i }));
    expect(onChange).toHaveBeenCalledWith({ options: [{ label: "Admin", value: "admin" }, { label: "", value: "" }] });
  });
  it("edits an option label", () => {
    const onChange = vi.fn();
    render(<OptionsSection card={sel} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue("Admin"), { target: { value: "Administrator" } });
    expect(onChange).toHaveBeenCalledWith({ options: [{ label: "Administrator", value: "admin" }] });
  });
  it("removes an option row", () => {
    const onChange = vi.fn();
    render(<OptionsSection card={sel} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /remove option/i }));
    expect(onChange).toHaveBeenCalledWith({ options: undefined });
  });
});
