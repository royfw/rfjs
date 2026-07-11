import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImportPanel } from "./import-panel";

const LABELS = {
  modeMeta: "meta.json", modeRows: "sample rows", placeholderMeta: "paste meta json…",
  placeholderRows: "paste rows json…", load: "Load", upload: "Upload .json",
  invalidJson: "Invalid JSON.", hint: "hint",
};

describe("ImportPanel", () => {
  it("loads a valid meta.json through onMeta", () => {
    const onMeta = vi.fn();
    render(<ImportPanel onMeta={onMeta} onFields={vi.fn()} labels={LABELS} />);

    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), {
      target: { value: '{"fields":[{"key":"a","label":"A","dataType":"string"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(onMeta).toHaveBeenCalledWith({ fields: [{ key: "a", label: "A", dataType: "string" }] });
  });

  it("shows a zod error for schema-invalid meta and does not call onMeta", () => {
    const onMeta = vi.fn();
    render(<ImportPanel onMeta={onMeta} onFields={vi.fn()} labels={LABELS} />);

    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), {
      target: { value: '{"fields":[{"key":"a","label":"A","dataType":"string","format":"currency"}]}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(onMeta).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/format|compatible/i);
  });

  it("shows the invalid-json message for malformed text", () => {
    render(<ImportPanel onMeta={vi.fn()} onFields={vi.fn()} labels={LABELS} />);

    fireEvent.change(screen.getByPlaceholderText("paste meta json…"), { target: { value: "not json {" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(screen.getByRole("alert").textContent).toBe("Invalid JSON.");
  });

  it("rows mode infers fields and calls onFields only", () => {
    const onMeta = vi.fn();
    const onFields = vi.fn();
    render(<ImportPanel onMeta={onMeta} onFields={onFields} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "sample rows" }));
    fireEvent.change(screen.getByPlaceholderText("paste rows json…"), {
      target: { value: '[{"name":"Ada","age":36}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(onMeta).not.toHaveBeenCalled();
    expect(onFields).toHaveBeenCalledWith([
      { key: "name", label: "name", dataType: "string" },
      { key: "age", label: "age", dataType: "numeric" },
    ]);
  });

  it("renders the hint next to the Load button", () => {
    render(<ImportPanel onMeta={vi.fn()} onFields={vi.fn()} labels={LABELS} />);

    expect(screen.getByText("hint")).toBeDefined();
  });

  it("auto-parses an uploaded meta.json through onMeta", async () => {
    const onMeta = vi.fn();
    const { container } = render(<ImportPanel onMeta={onMeta} onFields={vi.fn()} labels={LABELS} />);

    const file = new File(['{"fields":[{"key":"a","label":"A","dataType":"string"}]}'], "meta.json", {
      type: "application/json",
    });
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("file input not found");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onMeta).toHaveBeenCalledWith({ fields: [{ key: "a", label: "A", dataType: "string" }] });
    });
  });
});
