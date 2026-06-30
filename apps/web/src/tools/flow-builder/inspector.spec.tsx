import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/form-builder-ui", () => ({
  ConfigFormBuilder: ({ onChange }: { onChange?: (c: unknown) => void }) => (
    <button data-testid="cfb" onClick={() => onChange?.({ version: 1, fields: [{ key: "x" }] })}>form-editor</button>
  ),
}));
vi.mock("@rfjs/filter-builder-ui", () => ({
  FilterTreeEditor: () => <div data-testid="fte">filter-editor</div>,
}));

import { Inspector } from "./inspector";

const labels = { filter: {} as never, actionKinds: ["notify", "db.update"] };

describe("Inspector", () => {
  it("form node → ConfigFormBuilder, and forwards config change", () => {
    const onConfigChange = vi.fn();
    render(<Inspector node={{ id: "f1", data: { type: "form", config: { version: 1, fields: [] } } }} onConfigChange={onConfigChange} labels={labels} />);
    fireEvent.click(screen.getByTestId("cfb"));
    expect(onConfigChange).toHaveBeenCalledWith("f1", { version: 1, fields: [{ key: "x" }] });
  });

  it("condition node → FilterTreeEditor", () => {
    render(<Inspector node={{ id: "c1", data: { type: "condition" } }} onConfigChange={vi.fn()} labels={labels} />);
    expect(screen.getByTestId("fte")).toBeTruthy();
  });

  it("action node → kind select, change forwards config", () => {
    const onConfigChange = vi.fn();
    render(<Inspector node={{ id: "a1", data: { type: "action", config: { kind: "notify", params: {} } } }} onConfigChange={onConfigChange} labels={labels} />);
    fireEvent.change(screen.getByLabelText(/kind/i), { target: { value: "db.update" } });
    expect(onConfigChange).toHaveBeenCalledWith("a1", { kind: "db.update", params: {} });
  });

  it("no node selected → hint", () => {
    render(<Inspector node={null} onConfigChange={vi.fn()} labels={labels} />);
    expect(screen.getByText(/select a node/i)).toBeTruthy();
  });
});
