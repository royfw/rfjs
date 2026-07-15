import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "../model";
import { ResultSection } from "./result";

const resCard = (over?: Partial<Card>): Card => ({
  id: "res1", groupId: "g1", kind: "result", label: "Result",
  mode: "json", col: 1, span: 12, row: 1, ...over,
});
const apiButtons = [{ id: "btn_query", label: "Query" }];

describe("ResultSection", () => {
  it("mode select writes through; maxItems only visible for card mode", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ResultSection card={resCard()} onChange={onChange} apiButtons={apiButtons} />);
    expect(screen.queryByLabelText(/max items/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^mode$/i), { target: { value: "card" } });
    expect(onChange).toHaveBeenCalledWith({ mode: "card" });
    rerender(<ResultSection card={resCard({ mode: "card" })} onChange={onChange} apiButtons={apiButtons} />);
    expect(screen.getByLabelText(/max items/i)).toBeTruthy();
  });

  it("source select lists api buttons plus the unbound option", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard()} onChange={onChange} apiButtons={apiButtons} />);
    const select = screen.getByLabelText(/source/i) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["Last api response", "Query"]);
    fireEvent.change(select, { target: { value: "btn_query" } });
    expect(onChange).toHaveBeenCalledWith({ sourceId: "btn_query" });
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ sourceId: undefined });
  });

  it("dataPath / empty text write through", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard()} onChange={onChange} apiButtons={apiButtons} />);
    fireEvent.change(screen.getByLabelText(/data path/i), { target: { value: "data.items" } });
    expect(onChange).toHaveBeenCalledWith({ dataPath: "data.items" });
    fireEvent.change(screen.getByLabelText(/empty text/i), { target: { value: "Nothing" } });
    expect(onChange).toHaveBeenCalledWith({ emptyText: "Nothing" });
  });

  it("dangling sourceId renders a visible missing option", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard({ sourceId: "ghost" })} onChange={onChange} apiButtons={apiButtons} />);
    const select = screen.getByLabelText(/source/i) as HTMLSelectElement;
    expect(select.value).toBe("ghost");
    expect(screen.getByText("missing: ghost")).toBeTruthy();
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ sourceId: undefined });
  });

  it("maxItems rejects non-integers", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard({ mode: "card" })} onChange={onChange} apiButtons={apiButtons} />);
    fireEvent.change(screen.getByLabelText(/max items/i), { target: { value: "5.5" } });
    expect(onChange).toHaveBeenCalledWith({ maxItems: undefined });
  });
});

describe("ResultSection table snapshot", () => {
  it("snapshots pasted rows into resultTable", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard({ mode: "table" })} onChange={onChange} apiButtons={apiButtons} />);
    fireEvent.change(screen.getByPlaceholderText(/paste a sample/i), {
      target: { value: '[{"id":1,"name":"Ada"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: /snapshot/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ resultTable: expect.objectContaining({ columns: expect.any(Array) }) }),
    );
  });

  it("shows an error and does not write on invalid JSON", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard({ mode: "table" })} onChange={onChange} apiButtons={apiButtons} />);
    fireEvent.change(screen.getByPlaceholderText(/paste a sample/i), { target: { value: "{bad" } });
    fireEvent.click(screen.getByRole("button", { name: /snapshot/i }));
    expect(screen.getByText(/invalid json/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears resultTable", () => {
    const onChange = vi.fn();
    const withTable = resCard({
      mode: "table",
      resultTable: { columns: [{ key: "x", label: "X", dataType: "string" }], pagination: { pageSize: 10 } },
    });
    render(<ResultSection card={withTable} onChange={onChange} apiButtons={apiButtons} />);
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith({ resultTable: undefined });
  });
});
