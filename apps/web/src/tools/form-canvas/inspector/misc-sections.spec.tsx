import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AiNoteSection, ContentSection, SpacerSection } from "./misc-sections";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "X", key: "x", component: "Input", col: 1, span: 6, row: 1 };
const c: Card = { id: "c", groupId: "g", kind: "content", label: "Hi", col: 1, span: 12, row: 1 };
const s: Card = { id: "s", groupId: "g", kind: "spacer", label: "Spacer", col: 1, span: 12, row: 1 };

describe("misc sections", () => {
  it("AiNote sets aiNote", () => {
    const onChange = vi.fn();
    render(<AiNoteSection card={f} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/ai note/i), { target: { value: "hint" } });
    expect(onChange).toHaveBeenCalledWith({ aiNote: "hint" });
  });
  it("Content toggles locked", () => {
    const onChange = vi.fn();
    render(<ContentSection card={c} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/locked/i));
    expect(onChange).toHaveBeenCalledWith({ locked: true });
  });
  it("Spacer sets size", () => {
    const onChange = vi.fn();
    render(<SpacerSection card={s} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/size/i), { target: { value: "lg" } });
    expect(onChange).toHaveBeenCalledWith({ size: "lg" });
  });
});
