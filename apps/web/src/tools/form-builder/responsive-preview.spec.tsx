// jsdom shim for pointer events used by the drag handle
if (typeof Element !== "undefined") {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
}

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResponsivePreview } from "./responsive-preview";

describe("ResponsivePreview", () => {
  it("preset button sets width", async () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={1100} onWidthChange={onWidthChange}>
        <div>form</div>
      </ResponsivePreview>,
    );
    await userEvent.click(screen.getByRole("button", { name: /mobile/i }));
    expect(onWidthChange).toHaveBeenCalledWith(375);
  });

  it("number input clamps to max when above range", async () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={500} min={320} max={1280} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    const num = screen.getByRole("spinbutton");
    await userEvent.clear(num);
    await userEvent.type(num, "99999");
    expect(onWidthChange).toHaveBeenLastCalledWith(1280);
  });

  it("number input clamps to min when below range", () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={500} min={320} max={1280} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    const num = screen.getByRole("spinbutton");
    fireEvent.change(num, { target: { value: "10" } });
    expect(onWidthChange).toHaveBeenLastCalledWith(320);
  });

  it("renders children inside a width-constrained frame", () => {
    render(
      <ResponsivePreview width={400} onWidthChange={() => {}}>
        <div data-testid="kid" />
      </ResponsivePreview>,
    );
    const frame = screen.getByTestId("rp-frame");
    expect(frame.style.width).toBe("400px");
    expect(screen.getByTestId("kid")).toBeDefined();
  });

  it("tablet preset calls onWidthChange with 768", async () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={375} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    await userEvent.click(screen.getByRole("button", { name: /tablet/i }));
    expect(onWidthChange).toHaveBeenCalledWith(768);
  });

  it("desktop preset calls onWidthChange with max (default 1280)", async () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={375} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    await userEvent.click(screen.getByRole("button", { name: /desktop/i }));
    expect(onWidthChange).toHaveBeenCalledWith(1280);
  });

  it("desktop preset uses custom max when provided", async () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={375} max={1440} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    await userEvent.click(screen.getByRole("button", { name: /desktop/i }));
    expect(onWidthChange).toHaveBeenCalledWith(1440);
  });

  it("range slider clamps value to max when above range", () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={500} min={320} max={1280} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "99999" } });
    expect(onWidthChange).toHaveBeenLastCalledWith(1280);
  });

  it("range slider clamps value to min when below range", () => {
    const onWidthChange = vi.fn();
    render(
      <ResponsivePreview width={500} min={320} max={1280} onWidthChange={onWidthChange}>
        <div />
      </ResponsivePreview>,
    );
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "10" } });
    expect(onWidthChange).toHaveBeenLastCalledWith(320);
  });

  it("displays current width label", () => {
    render(
      <ResponsivePreview width={640} onWidthChange={() => {}}>
        <div />
      </ResponsivePreview>,
    );
    expect(screen.getByText(/640/)).toBeDefined();
  });

  it("compact mode uses xs size on preset buttons", () => {
    render(
      <ResponsivePreview width={375} onWidthChange={() => {}} compact>
        <div data-testid="compact-child" />
      </ResponsivePreview>,
    );
    const mobileBtn = screen.getByRole("button", { name: /mobile/i });
    expect(mobileBtn.getAttribute("data-size")).toBe("xs");
  });

  it("non-compact mode uses sm size on preset buttons", () => {
    render(
      <ResponsivePreview width={375} onWidthChange={() => {}}>
        <div />
      </ResponsivePreview>,
    );
    const mobileBtn = screen.getByRole("button", { name: /mobile/i });
    expect(mobileBtn.getAttribute("data-size")).toBe("sm");
  });

  it("rp-frame has a visible border class to show device-width boundary", () => {
    render(
      <ResponsivePreview width={400} onWidthChange={() => {}}>
        <div />
      </ResponsivePreview>,
    );
    const frame = screen.getByTestId("rp-frame");
    expect(frame.className).toMatch(/border/);
  });
});
