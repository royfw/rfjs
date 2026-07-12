import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { ToolIntro } from "./tool-intro";

const LABELS = { expand: "Expand", collapse: "Collapse", dismiss: "Dismiss" };
const CONCEPTS = [
  { term: "Resource", desc: "A DataResourceMeta." },
  { term: "Protocol", desc: "With = queryable; without = static rows." },
  { term: "Preview", desc: "Offline sample or live endpoint." },
];

function renderIntro() {
  return render(
    <ToolIntro
      storageKey="tool-intro:test"
      question="How does this tool work?"
      tagline="One resource → config → preview"
      concepts={CONCEPTS}
      labels={LABELS}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("ToolIntro", () => {
  it("renders collapsed by default: question visible, concept descriptions hidden", () => {
    renderIntro();
    expect(screen.getByText("How does this tool work?")).toBeTruthy();
    expect(screen.queryByText("A DataResourceMeta.")).toBeNull();
    expect(screen.getByRole("button", { name: /how does this tool work/i }).getAttribute("aria-expanded")).toBe("false");
  });

  it("clicking the header expands the concepts and toggles aria-expanded", () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /how does this tool work/i }));
    expect(screen.getByText("A DataResourceMeta.")).toBeTruthy();
    expect(screen.getByText("Resource")).toBeTruthy();
    expect(screen.getByRole("button", { name: /how does this tool work/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Collapse")).toBeTruthy();
  });

  it("dismiss hides the block and persists to localStorage", () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("How does this tool work?")).toBeNull();
    const stored = JSON.parse(localStorage.getItem("tool-intro:test") ?? "{}");
    expect(stored.dismissed).toBe(true);
  });

  it("restores open state from localStorage", async () => {
    localStorage.setItem("tool-intro:test", JSON.stringify({ open: true, dismissed: false }));
    renderIntro();
    expect(await screen.findByText("A DataResourceMeta.")).toBeTruthy();
  });

  it("restores dismissed state from localStorage (renders nothing)", async () => {
    localStorage.setItem("tool-intro:test", JSON.stringify({ open: false, dismissed: true }));
    renderIntro();
    // dismissal applies after the mount-restore effect
    expect(screen.queryByText("How does this tool work?")).toBeNull();
  });

  it("corrupted stored JSON falls back to defaults (collapsed, visible)", () => {
    localStorage.setItem("tool-intro:test", "not-json{");
    renderIntro();
    expect(screen.getByText("How does this tool work?")).toBeTruthy();
    expect(screen.queryByText("A DataResourceMeta.")).toBeNull();
  });

  it("persists open state after toggling (restore-before-persist holds)", () => {
    renderIntro();
    fireEvent.click(screen.getByRole("button", { name: /how does this tool work/i }));
    const stored = JSON.parse(localStorage.getItem("tool-intro:test") ?? "{}");
    expect(stored.open).toBe(true);
  });
});
