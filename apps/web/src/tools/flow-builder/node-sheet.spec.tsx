import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NodeSheet } from "./node-sheet";

describe("NodeSheet", () => {
  it("renders the title, dialog role, and children", () => {
    render(
      <NodeSheet title="Inspector" closeLabel="Close" onClose={() => {}}>
        <div>body</div>
      </NodeSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Inspector" })).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });

  it("close button calls onClose", () => {
    const onClose = vi.fn();
    render(
      <NodeSheet title="Inspector" closeLabel="Close" onClose={onClose}>
        <div />
      </NodeSheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape key calls onClose", () => {
    const onClose = vi.fn();
    render(
      <NodeSheet title="Inspector" closeLabel="Close" onClose={onClose}>
        <div />
      </NodeSheet>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
