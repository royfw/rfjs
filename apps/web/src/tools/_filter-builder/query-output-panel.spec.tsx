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
    // labels.output names BOTH the chevron (collapseLabel) and the output tab —
    // disambiguate via aria-selected (only tab buttons carry it).
    const outputTab = screen
      .getAllByRole("button", { name: labels.output })
      .find((el) => el.hasAttribute("aria-selected"));
    const canonicalTab = screen.getByRole("button", { name: "{ }" });
    expect(outputTab?.getAttribute("aria-selected")).toBe("true");
    expect(canonicalTab.getAttribute("aria-selected")).toBe("false");
    fireEvent.click(canonicalTab);
    expect(screen.getByRole("textbox")).toBeDefined();
    expect(canonicalTab.getAttribute("aria-selected")).toBe("true");
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

  it("collapses: toggling the header hides the primary output", () => {
    render(
      <QueryOutputPanel
        primary={"data #>> '{name}' = $1"}
        secondary={null}
        canonicalJson="{}"
        onCanonicalChange={vi.fn()}
        labels={labels}
      />,
    );
    const toggle = screen.getByRole("button", { expanded: true });
    expect(screen.getByText("data #>> '{name}' = $1")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("data #>> '{name}' = $1")).toBeNull();
  });
});
