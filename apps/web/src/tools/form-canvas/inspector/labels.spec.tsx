import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LabelsSection } from "./labels";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "Name", key: "n", component: "Input", col: 1, span: 6, row: 1 };

describe("LabelsSection", () => {
  it("setting zh-TW on a string label produces a record keeping en", () => {
    const onChange = vi.fn();
    render(<LabelsSection card={f} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/zh-TW/i), { target: { value: "姓名" } });
    expect(onChange).toHaveBeenCalledWith({ label: { en: "Name", "zh-TW": "姓名" } });
  });
  it("editing en on a record updates that locale", () => {
    const onChange = vi.fn();
    render(<LabelsSection card={{ ...f, label: { en: "Name", "zh-TW": "姓名" } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^en$/i), { target: { value: "Full name" } });
    expect(onChange).toHaveBeenCalledWith({ label: { en: "Full name", "zh-TW": "姓名" } });
  });
});
