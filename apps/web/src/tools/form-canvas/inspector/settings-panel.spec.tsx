import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsPanel } from "./settings-panel";
import type { Card } from "../model";

const field: Card = { id: "f1", groupId: "g1", kind: "field", label: "Name", key: "name", component: "Input", col: 1, span: 6, row: 1 };

describe("SettingsPanel", () => {
  it("shows empty hint with no card", () => {
    render(<SettingsPanel card={null} groups={[]} onChange={() => {}} onRemove={() => {}} />);
    expect(screen.getByText(/select a card/i)).toBeTruthy();
  });
  it("edits the basics label", () => {
    const onChange = vi.fn();
    render(<SettingsPanel card={field} groups={[{ id: "g1", title: "G", collapsed: false }]} onChange={onChange} onRemove={() => {}} />);
    fireEvent.change(screen.getByLabelText(/^label$/i), { target: { value: "Full name" } });
    expect(onChange).toHaveBeenCalledWith({ label: "Full name" });
  });
  it("collapses a section when its header is clicked", () => {
    render(<SettingsPanel card={field} groups={[{ id: "g1", title: "G", collapsed: false }]} onChange={() => {}} onRemove={() => {}} />);
    const basics = screen.getByRole("button", { name: /basics/i });
    fireEvent.click(basics); // collapse
    expect(screen.queryByLabelText(/^label$/i)).toBeNull();
  });
});
