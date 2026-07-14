import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SectionCard } from "./section-card";

describe("SectionCard", () => {
  it("solo mode: mono-uppercase title + action + body", () => {
    render(
      <SectionCard title="Sample JSON" action={<span>raw (2)</span>}>
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByRole("heading", { name: "Sample JSON" })).toBeTruthy();
    expect(screen.getByText("raw (2)")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
  it("tab mode: a tab per entry, active marked, change reported", () => {
    const onTabChange = vi.fn();
    render(
      <SectionCard
        tabs={[
          { id: "a", label: "Sample" },
          { id: "b", label: "Schema" },
        ]}
        activeTab="a"
        onTabChange={onTabChange}
      >
        <p>body</p>
      </SectionCard>,
    );
    expect(screen.getByRole("button", { name: "Sample" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Schema" }));
    expect(onTabChange).toHaveBeenCalledWith("b");
  });
  it("className/style pass through to the section (fb-rise survives)", () => {
    const { container } = render(
      <SectionCard title="X" className="fb-rise" style={{ animationDelay: "70ms" }}>
        y
      </SectionCard>,
    );
    const s = container.querySelector("section")!;
    expect(s.className).toContain("fb-rise");
    expect(s.getAttribute("style")).toContain("70ms");
  });
  it("bodyClassName overrides the default p-4 body", () => {
    const { container } = render(
      <SectionCard title="X" bodyClassName="overflow-x-auto p-5 sm:p-6">
        y
      </SectionCard>,
    );
    // the body div is the last child of the section
    const body = container.querySelector("section > div:last-child")!;
    expect(body.className).toContain("overflow-x-auto");
    expect(body.className).not.toContain("p-4");
  });
  it("collapsible uncontrolled: open by default, toggles, hides body when closed", () => {
    render(
      <SectionCard title="Out" collapsible>
        <p>payload</p>
      </SectionCard>,
    );
    const toggle = screen.getByRole("button", { name: /out/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("payload")).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("payload")).toBeNull();
  });
  it("collapsible uncontrolled: defaultOpen=false starts closed", () => {
    render(
      <SectionCard title="Out" collapsible defaultOpen={false}>
        <p>payload</p>
      </SectionCard>,
    );
    expect(screen.queryByText("payload")).toBeNull();
  });
  it("collapsible controlled: reflects open prop + reports onOpenChange, does not self-toggle", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <SectionCard title="S" collapsible open={true} onOpenChange={onOpenChange}>
        <p>payload</p>
      </SectionCard>,
    );
    const toggle = screen.getByRole("button", { name: /^s/i });
    fireEvent.click(toggle);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    // still open because parent controls it and hasn't changed the prop
    expect(screen.getByText("payload")).toBeTruthy();
    rerender(
      <SectionCard title="S" collapsible open={false} onOpenChange={onOpenChange}>
        <p>payload</p>
      </SectionCard>,
    );
    expect(screen.queryByText("payload")).toBeNull();
  });
});
