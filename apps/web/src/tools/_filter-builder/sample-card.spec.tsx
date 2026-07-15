import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SampleCard, type SampleCardLabels } from "./sample-card";

const labels: SampleCardLabels = {
  sample: "Sample JSON",
  invalidSample: "Invalid JSON — open to fix",
  rawCount: "raw (2)",
  upload: "Upload",
};

describe("SampleCard", () => {
  it("open: shows the sample textarea and the raw count", () => {
    render(
      <SampleCard
        open={true}
        onToggle={vi.fn()}
        value='[{"a":1}]'
        onChange={vi.fn()}
        onUpload={vi.fn()}
        hasError={false}
        labels={labels}
      />,
    );
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByText("raw (2)")).toBeTruthy();
  });

  it("clicking the title toggles (calls onToggle)", () => {
    const onToggle = vi.fn();
    render(
      <SampleCard
        open={true}
        onToggle={onToggle}
        value=""
        onChange={vi.fn()}
        onUpload={vi.fn()}
        hasError={false}
        labels={labels}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /sample json/i }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("closed: hides the body (textarea not rendered)", () => {
    render(
      <SampleCard
        open={false}
        onToggle={vi.fn()}
        value=""
        onChange={vi.fn()}
        onUpload={vi.fn()}
        hasError={false}
        labels={labels}
      />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("shows the invalid-sample error (action + body) when hasError", () => {
    render(
      <SampleCard
        open={true}
        onToggle={vi.fn()}
        value="not json"
        onChange={vi.fn()}
        onUpload={vi.fn()}
        hasError={true}
        labels={labels}
      />,
    );
    expect(screen.getAllByText(labels.invalidSample).length).toBeGreaterThan(0);
  });
});
