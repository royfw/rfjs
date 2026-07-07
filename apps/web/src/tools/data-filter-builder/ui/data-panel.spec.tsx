import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataPanel } from "./data-panel";

const labels = {
  data: "data",
  counts: "raw {raw} · matched {matched}",
  raw: "raw",
  matched: "matched",
  json: "json",
  empty: "no rows",
  canonicalHint: "canonical",
  copy: "copy",
};

describe("DataPanel", () => {
  it("shows the collapsed counts", () => {
    render(
      <DataPanel
        rows={[{ name: "Ada" }]}
        matched={[{ name: "Ada" }]}
        canonicalJson="{}"
        onCanonicalChange={vi.fn()}
        error={null}
        labels={labels}
      />,
    );
    expect(screen.getByText("raw 1 · matched 1")).toBeDefined();
  });

  it("expands to show the matched table headers", () => {
    render(
      <DataPanel
        rows={[{ name: "Ada" }]}
        matched={[{ name: "Ada" }]}
        canonicalJson="{}"
        onCanonicalChange={vi.fn()}
        error={null}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByText(/data/i));
    expect(screen.getByRole("columnheader", { name: "name" })).toBeDefined();
  });

  it("renders the json tab error inline", () => {
    render(
      <DataPanel
        rows={[]}
        matched={[]}
        canonicalJson="{}"
        onCanonicalChange={vi.fn()}
        error="bad json"
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByText(/data/i));
    fireEvent.click(screen.getByRole("button", { name: "json" }));
    expect(screen.getByText("bad json")).toBeDefined();
  });
});
