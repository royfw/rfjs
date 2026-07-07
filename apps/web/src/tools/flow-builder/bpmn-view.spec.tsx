import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/bpmn-ui", () => ({
  BpmnViewer: ({ xml }: { xml: string }) => <div data-testid="bpmn-viewer">{xml}</div>,
}));

import { messages } from "./messages";
import { sample } from "./sample";
import { BpmnViewPanel } from "./bpmn-view";

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <BpmnViewPanel doc={sample} />
    </NextIntlClientProvider>,
  );
}

describe("BpmnViewPanel", () => {
  it("feeds compiled bpmn xml to the viewer", () => {
    renderPanel();
    const xml = screen.getByTestId("bpmn-viewer").textContent ?? "";
    expect(xml).toContain("<bpmn:definitions");
    expect(xml).toContain("<bpmn:userTask");
    expect(xml).toContain("<bpmn:serviceTask");
  });

  it("projection switch filters service tasks but keeps user tasks", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: /human tasks only/i }));
    const xml = screen.getByTestId("bpmn-viewer").textContent ?? "";
    expect(xml).not.toContain("<bpmn:serviceTask");
    expect(xml).toContain("<bpmn:userTask");
    expect(xml).toContain("<bpmn:exclusiveGateway");
  });

  it("download button builds a blob url and clicks an anchor", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /download \.bpmn/i }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
