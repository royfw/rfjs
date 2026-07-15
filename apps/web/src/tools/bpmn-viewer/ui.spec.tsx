// jsdom shim: radix-ui Select 需要 pointer capture / scrollIntoView。
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/bpmn-ui", () => ({
  BpmnViewer: ({ xml }: { xml: string }) => <div data-testid="bpmn-viewer">{xml}</div>,
  useBpmnViewer: () => ({
    viewerProps: { ref: { current: null }, onLoadingChange: () => {}, onError: () => {} },
    zoomIn: () => {},
    zoomOut: () => {},
    resetZoom: () => {},
    fitViewport: () => {},
    importing: false,
    error: null,
  }),
}));

import { assembleMessages } from "@/i18n/messages";

import { BpmnViewerTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
      <BpmnViewerTool />
    </NextIntlClientProvider>,
  );
}

describe("BpmnViewerTool", () => {
  it("renders the default sample into the viewer", () => {
    renderTool();
    const viewer = screen.getByTestId("bpmn-viewer");
    expect(viewer.textContent).toContain("<bpmn:definitions");
  });

  it("renders pasted XML when Render is clicked", () => {
    renderTool();
    const textarea = screen.getByLabelText(/paste bpmn xml/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "<bpmn:definitions id='X'/>" } });
    fireEvent.click(screen.getByRole("button", { name: /^render$/i }));
    expect(screen.getByTestId("bpmn-viewer").textContent).toContain("id='X'");
  });

  it("shows an error for an unsupported uploaded file type", () => {
    renderTool();
    const file = new File(["data"], "notes.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("bpmn-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toMatch(/unsupported file type/i);
  });
});
