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
    ReactFlow: ({
      nodes,
      onNodeClick,
      children,
    }: {
      nodes: { id: string; [key: string]: unknown }[];
      onNodeClick?: (e: unknown, n: unknown) => void;
      children?: React.ReactNode;
    }) => (
      <div data-testid="rf" data-nodecount={nodes.length}>
        {nodes.map((n) => (
          <button key={n.id} data-testid={`rfnode-${n.id}`} onClick={() => onNodeClick?.({}, n)}>
            {n.id}
          </button>
        ))}
        {children}
      </div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
    MarkerType: { Arrow: "arrow", ArrowClosed: "arrowclosed" },
    addEdge: (c: unknown, edges: unknown[]) => [...edges, c],
    useNodesState: (initial: unknown[]) => {
      const [n, setN] = (React2 as typeof import("react")).useState(initial);
      return [n, setN, () => {}];
    },
    useEdgesState: (initial: unknown[]) => {
      const [e, setE] = (React2 as typeof import("react")).useState(initial);
      return [e, setE, () => {}];
    },
  };
});

// Stateful mock: seeds internal state from initialConfig once on mount,
// so the stale-state bug is observable when the component is NOT remounted.
vi.mock("@rfjs/form-builder-ui", async () => {
  const React3 = await vi.importActual<typeof import("react")>("react");
  const R = React3 as typeof import("react");
  return {
    ConfigFormBuilder: ({ initialConfig }: { initialConfig: unknown }) => {
      const [cfg] = R.useState(initialConfig);
      return R.createElement("div", { "data-testid": "cfb", "data-cfg": JSON.stringify(cfg) });
    },
  };
});
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

  it("inspector remounts per node — no stale state when switching same-type nodes", () => {
    renderTool();
    // Click the pre-existing form node from sample (has 1 field: 'days')
    fireEvent.click(screen.getByTestId("rfnode-form-1"));
    const cfb = screen.getByTestId("cfb");
    const cfg1 = JSON.parse(cfb.getAttribute("data-cfg") ?? "{}") as { fields: unknown[] };
    expect(cfg1.fields).toHaveLength(1);

    // Add a new (empty) form node then click it
    fireEvent.click(screen.getByRole("button", { name: /\+ form/i }));
    const formStubs = screen.getAllByTestId(/^rfnode-form-/);
    fireEvent.click(formStubs[formStubs.length - 1]!);

    // Must show empty config — NOT form-1's stale field
    const cfg2 = JSON.parse(screen.getByTestId("cfb").getAttribute("data-cfg") ?? "{}") as { fields: unknown[] };
    expect(cfg2.fields).toHaveLength(0);
  });
});
