import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "./panel";

describe("Panel", () => {
  it("renders the title and children", () => {
    render(<Panel title="Datasets">3 samples</Panel>);
    expect(screen.getByRole("heading", { name: "Datasets" })).toBeDefined();
    expect(screen.getByText("3 samples")).toBeDefined();
  });

  it("omits the heading when no title is given", () => {
    render(<Panel>body only</Panel>);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders an action in the header", () => {
    render(
      <Panel title="Output" action={<button>copy</button>}>
        body
      </Panel>,
    );
    expect(screen.getByRole("button", { name: "copy" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Output" })).toBeDefined();
  });

  it("renders the action even with no title, and still no heading", () => {
    render(<Panel action={<button>copy</button>}>body</Panel>);
    expect(screen.getByRole("button", { name: "copy" })).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
