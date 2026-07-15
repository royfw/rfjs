import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolTabs } from "./tool-tabs";
describe("ToolTabs", () => {
  it("renders a plain button per tab, marks active, reports changes", () => {
    const onChange = vi.fn();
    render(
      <ToolTabs
        tabs={[
          { id: "a", label: "Canvas" },
          { id: "b", label: "Preview" },
        ]}
        active="a"
        onChange={onChange}
      />,
    );
    const a = screen.getByRole("button", { name: "Canvas" });
    expect(a.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
