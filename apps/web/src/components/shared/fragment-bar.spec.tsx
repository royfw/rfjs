import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FragmentBar } from "./fragment-bar";
describe("FragmentBar", () => {
  it("renders its children as a status strip", () => {
    render(<FragmentBar>WHERE · 0 params</FragmentBar>);
    expect(screen.getByText("WHERE · 0 params")).toBeTruthy();
  });
});
