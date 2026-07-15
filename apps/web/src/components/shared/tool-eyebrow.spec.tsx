import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolEyebrow } from "./tool-eyebrow";
describe("ToolEyebrow", () => {
  it("renders children as a small-caps label", () => {
    render(<ToolEyebrow>SQL FILTER BUILDER</ToolEyebrow>);
    expect(screen.getByText("SQL FILTER BUILDER")).toBeTruthy();
  });
});
