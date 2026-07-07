import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ValidationSection } from "./validation";
import type { Card } from "../model";

const numField: Card = { id: "f", groupId: "g", kind: "field", label: "Age", key: "age", component: "Number", col: 1, span: 6, row: 1 };
const strField: Card = { ...numField, component: "Input", label: "Name", key: "name" };

describe("ValidationSection", () => {
  it("sets min for a numeric field", () => {
    const onChange = vi.fn();
    render(<ValidationSection card={numField} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/^min$/i), { target: { value: "18" } });
    expect(onChange).toHaveBeenCalledWith({ validation: { min: 18 } });
  });
  it("sets pattern + message for a string field, merging existing validation", () => {
    const onChange = vi.fn();
    render(<ValidationSection card={{ ...strField, validation: { minLength: 2 } }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/pattern/i), { target: { value: "^a" } });
    expect(onChange).toHaveBeenCalledWith({ validation: { minLength: 2, pattern: "^a" } });
  });
  it("shows minLength (string) not min for a string field", () => {
    render(<ValidationSection card={strField} onChange={() => {}} />);
    expect(screen.queryByLabelText(/^min$/i)).toBeNull();
    expect(screen.getByLabelText(/min length/i)).toBeTruthy();
  });
});
