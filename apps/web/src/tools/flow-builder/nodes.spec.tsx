import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { nodeTypes } from "./nodes";

function renderNode(type: keyof typeof nodeTypes, data: Record<string, unknown>) {
  const Cmp = nodeTypes[type] as React.ComponentType<{ id: string; data: unknown }>;
  return render(<Cmp id="n1" data={data} />);
}

describe("flow node components", () => {
  it("form node shows its label and field count", () => {
    renderNode("form", { type: "form", config: { version: 1, fields: [{ key: "a" }, { key: "b" }] } });
    expect(screen.getByText(/form/i)).toBeTruthy();
    expect(screen.getByText(/2 fields/i)).toBeTruthy();
  });

  it("action node shows its kind", () => {
    renderNode("action", { type: "action", config: { kind: "notify", params: {} } });
    expect(screen.getByText(/kind: notify/i)).toBeTruthy();
  });

  it("condition node renders its label", () => {
    renderNode("condition", { type: "condition" });
    expect(screen.getByText(/condition/i)).toBeTruthy();
  });
});
