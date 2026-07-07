import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "../model";
import { ActionSection } from "./action";

const btnCard = (over?: Partial<Card>): Card => ({
  id: "b1", groupId: "g1", kind: "button", label: "Go",
  action: { type: "custom", name: "save-draft" },
  col: 1, span: 3, row: 1, ...over,
});

const fields = [{ key: "name", dataType: "string" }, { key: "amount", dataType: "numeric" }];

describe("ActionSection", () => {
  it("switching type to clear shows the field multi-select and writes a valid clear action", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard()} onChange={onChange} siblingFields={fields} />);
    fireEvent.change(screen.getByLabelText(/action type/i), { target: { value: "clear" } });
    expect(onChange).toHaveBeenCalledWith({ action: { type: "clear", fields: [] } });
  });

  it("clear: toggling a field key adds it to action.fields", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard({ action: { type: "clear", fields: [] } })} onChange={onChange} siblingFields={fields} />);
    fireEvent.click(screen.getByLabelText("name"));
    expect(onChange).toHaveBeenCalledWith({ action: { type: "clear", fields: ["name"] } });
  });

  it("custom: renders the name input", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard()} onChange={onChange} siblingFields={fields} />);
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "notify" } });
    expect(onChange).toHaveBeenCalledWith({ action: { type: "custom", name: "notify" } });
  });

  it("api: renders url/method and responseMap editor", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard({ action: { type: "api", url: "/x" } })} onChange={onChange} siblingFields={fields} />);
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "/api/y" } });
    expect(onChange).toHaveBeenCalledWith({ action: { type: "api", url: "/api/y" } });
    expect(screen.getByText(/response map/i)).toBeTruthy();
  });

  it("validate switch writes through", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard()} onChange={onChange} siblingFields={fields} />);
    fireEvent.click(screen.getByLabelText(/validate before run/i));
    expect(onChange).toHaveBeenCalledWith({ validate: true });
  });
});
