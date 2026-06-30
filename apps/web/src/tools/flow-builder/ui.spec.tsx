if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", async () => {
  const React2 = await vi.importActual<typeof import("react")>("react");
  return {
    ReactFlow: ({ nodes, children }: { nodes: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="rf" data-nodecount={nodes.length}>{children}</div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
    addEdge: (c: unknown, edges: unknown[]) => [...edges, c],
    useNodesState: (initial: unknown[]) => {
      const [n, setN] = React2.useState(initial);
      return [n, setN, () => {}];
    },
    useEdgesState: (initial: unknown[]) => {
      const [e, setE] = React2.useState(initial);
      return [e, setE, () => {}];
    },
  };
});
vi.mock("@rfjs/form-builder-ui", () => ({ ConfigFormBuilder: () => <div data-testid="cfb" /> }));
vi.mock("@rfjs/filter-builder-ui", () => ({ FilterTreeEditor: () => <div data-testid="fte" /> }));

import { messages } from "./messages";
import { FlowBuilderTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <FlowBuilderTool />
    </NextIntlClientProvider>,
  );
}

describe("FlowBuilderTool", () => {
  it("renders the sample flow into the canvas", () => {
    renderTool();
    expect(Number(screen.getByTestId("rf").getAttribute("data-nodecount"))).toBeGreaterThanOrEqual(6);
  });

  it("palette '+ Action' adds a node (count increases)", () => {
    renderTool();
    const before = Number(screen.getByTestId("rf").getAttribute("data-nodecount"));
    fireEvent.click(screen.getByRole("button", { name: /\+ action/i }));
    expect(Number(screen.getByTestId("rf").getAttribute("data-nodecount"))).toBe(before + 1);
  });

  it("shows the live flow JSON panel containing a node id", () => {
    renderTool();
    expect(screen.getByText(/"flow-builder"|"start"|"version": 1/)).toBeTruthy();
  });
});
