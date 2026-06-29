import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConditionalSection } from "./conditional";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "Manager", key: "manager", component: "Input", col: 1, span: 6, row: 1 };

describe("ConditionalSection", () => {
  it("enabling adds an empty and-group", () => {
    const onChange = vi.fn();
    render(<ConditionalSection card={f} siblingFields={[{ key: "role", dataType: "string" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /enable condition/i }));
    expect(onChange).toHaveBeenCalledWith({ conditional: { logic: "and", filters: [] } });
  });
  it("adds a condition row to the root group", () => {
    const onChange = vi.fn();
    render(<ConditionalSection card={{ ...f, conditional: { logic: "and", filters: [] } }} siblingFields={[{ key: "role", dataType: "string" }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /add condition/i }));
    expect(onChange).toHaveBeenCalledWith({ conditional: { logic: "and", filters: [{ field: "role", dataType: "string", operator: "eq", value: "" }] } });
  });
  it("changes the root logic", () => {
    const onChange = vi.fn();
    render(<ConditionalSection card={{ ...f, conditional: { logic: "and", filters: [] } }} siblingFields={[{ key: "role", dataType: "string" }]} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/group logic/i), { target: { value: "or" } });
    expect(onChange).toHaveBeenCalledWith({ conditional: { logic: "or", filters: [] } });
  });
  it("offers numeric operators for a numeric condition", () => {
    const onChange = vi.fn();
    render(
      <ConditionalSection
        card={{ ...f, conditional: { logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "eq", value: "" } as never] } }}
        siblingFields={[{ key: "age", dataType: "numeric" }]}
        onChange={onChange}
      />,
    );
    const operatorSelect = screen.getByLabelText(/operator 0/i);
    const options = Array.from(operatorSelect.querySelectorAll("option")).map((o) => (o as HTMLOptionElement).value);
    expect(options).toContain("gt");
  });
});
