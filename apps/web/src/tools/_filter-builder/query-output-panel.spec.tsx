import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryOutputPanel, type QueryOutputLabels } from "./query-output-panel";

const labels: QueryOutputLabels = {
  output: "Compiled query",
  primaryLabel: "WHERE",
  secondaryLabel: "values",
  canonical: "{ }",
  canonicalHint: "canonical",
  reverseError: null,
  compileError: null,
  copy: "copy",
};

describe("QueryOutputPanel", () => {
  it("shows the primary (WHERE) text and secondary values", () => {
    render(
      <QueryOutputPanel
        primary={"data #>> '{name}' = $1"}
        secondary={'["Ada"]'}
        canonicalJson="{}"
        onCanonicalChange={vi.fn()}
        labels={labels}
      />,
    );
    expect(screen.getByText("data #>> '{name}' = $1")).toBeDefined();
    expect(screen.getByText('["Ada"]')).toBeDefined();
  });

  it("reveals the canonical textarea when the canonical tab is clicked", () => {
    render(
      <QueryOutputPanel
        primary="x = $1"
        secondary={null}
        canonicalJson='{"logic":"and"}'
        onCanonicalChange={vi.fn()}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "{ }" }));
    expect(screen.getByRole("textbox")).toBeDefined();
  });

  it("renders the compile error in place of the output", () => {
    render(
      <QueryOutputPanel
        primary={null}
        secondary={null}
        canonicalJson="{}"
        onCanonicalChange={vi.fn()}
        labels={{ ...labels, compileError: "Could not compile: boom" }}
      />,
    );
    expect(screen.getByText("Could not compile: boom")).toBeDefined();
  });
});
