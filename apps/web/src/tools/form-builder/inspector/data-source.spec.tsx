import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataSourceSection } from "./data-source";
import type { Card } from "../model";

const f: Card = { id: "f", groupId: "g", kind: "field", label: "Country", key: "country", component: "Select", col: 1, span: 6, row: 1 };

describe("DataSourceSection", () => {
  it("setting url creates a dataSource with default extract", () => {
    const onChange = vi.fn();
    render(<DataSourceSection card={f} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "/api/c" } });
    expect(onChange).toHaveBeenCalledWith({ dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "" } } });
  });
  it("clearing url removes the dataSource", () => {
    const ds: Card = { ...f, dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "data" } } };
    const onChange = vi.fn();
    render(<DataSourceSection card={ds} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ dataSource: undefined });
  });
  it("sets optionLabel preserving url/extract", () => {
    const ds: Card = { ...f, dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "data" } } };
    const onChange = vi.fn();
    render(<DataSourceSection card={ds} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/option label/i), { target: { value: "name" } });
    expect(onChange).toHaveBeenCalledWith({ dataSource: { request: { url: "/api/c" }, extract: { dialect: "path", expr: "data" }, optionLabel: "name" } });
  });
});
