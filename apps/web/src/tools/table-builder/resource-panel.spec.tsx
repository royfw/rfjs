import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ResourcePanel } from "./resource-panel";
import type { ResourcePanelProps } from "./resource-panel";

const LABELS = {
  title: "Data resource",
  seedMeta: "Import meta.json",
  seedRows: "Paste rows",
  seedSample: "Sample resource",
  metaPlaceholder: "Paste a DataResourceMeta…",
  metaHint: "Fields + protocol come from the meta; rows stay.",
  metaInvalid: "Invalid JSON.",
  sampleHint: "Reset to the built-in sample resource.",
  sampleLoad: "Load sample",
  fieldsSummary: "7 fields — edit display in the Columns tab",
  protoHint: "With a protocol the resource is queryable; without it, static rows.",
  previewLabel: "Preview via",
  previewOffline: "Sample data (offline)",
  previewLive: "Call endpoint (live)",
};
const IMPORT_LABELS = { paste: "Paste JSON or CSV…", upload: "Upload", load: "Load", json: "JSON", csv: "CSV" };

const META_JSON = JSON.stringify({
  fields: [{ key: "id", label: "ID", dataType: "string" }],
  request: { endpoint: "/api/x", method: "GET", pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" } },
  response: { rowsPath: "data.items" },
});

function renderPanel(over: Partial<ResourcePanelProps> = {}) {
  const props: ResourcePanelProps = {
    labels: LABELS,
    importLabels: IMPORT_LABELS,
    onImportRows: vi.fn(),
    onImportMeta: vi.fn(),
    onSampleReset: vi.fn(),
    hasProtocol: true,
    preview: "offline",
    onPreviewChange: vi.fn(),
    ...over,
  };
  render(<ResourcePanel {...props} />);
  return props;
}

describe("ResourcePanel seeds", () => {
  it("renders the three seed chips, meta selected by default", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Import meta.json" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Paste rows" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sample resource" })).toBeTruthy();
  });

  it("meta seed: loading a valid DataResourceMeta reports it", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta…"), { target: { value: META_JSON } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(props.onImportMeta).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ endpoint: "/api/x" }) }),
    );
  });

  it("meta seed: invalid JSON shows the invalid label and reports nothing", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta…"), { target: { value: "{oops" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByRole("alert").textContent).toBe("Invalid JSON.");
    expect(props.onImportMeta).not.toHaveBeenCalled();
  });

  it("meta seed: zod-invalid meta surfaces issues[0].message, not the raw JSON blob", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta…"), { target: { value: JSON.stringify({ fields: "nope" }) } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    const alert = screen.getByRole("alert").textContent ?? "";
    expect(alert.startsWith("[")).toBe(false);
    expect(alert.length).toBeGreaterThan(0);
    expect(props.onImportMeta).not.toHaveBeenCalled();
  });

  it("rows seed: loading valid pasted JSON reports the parsed rows", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    fireEvent.change(screen.getByPlaceholderText("Paste JSON or CSV…"), { target: { value: '[{"a":1}]' } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(props.onImportRows).toHaveBeenCalledWith([{ a: 1 }]);
  });

  it("rows seed: CSV format chip parses typed rows", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    fireEvent.click(screen.getByRole("button", { name: "CSV" }));
    fireEvent.change(screen.getByPlaceholderText("Paste JSON or CSV…"), { target: { value: "a,b\n1,x" } });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(props.onImportRows).toHaveBeenCalledWith([{ a: 1, b: "x" }]);
  });

  it("rows seed: pre-fills the paste box with defaultRowsText", () => {
    renderPanel({ defaultRowsText: '[{"seed":true}]' });
    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    expect(screen.getByDisplayValue('[{"seed":true}]')).toBeTruthy();
  });

  it("upload stays a label-wrapped file input (no accessible-name collision with Load)", () => {
    renderPanel();
    expect(screen.queryByRole("button", { name: "Upload" })).toBeNull();
    expect(screen.getByText("Upload")).toBeTruthy();
  });

  it("sample seed: shows the hint and reports reset on click", () => {
    const props = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Sample resource" }));
    expect(screen.getByText("Reset to the built-in sample resource.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load sample" }));
    expect(props.onSampleReset).toHaveBeenCalled();
  });
});

describe("ResourcePanel preview toggle", () => {
  it("shows offline/live only when the resource has a protocol, and reports changes", () => {
    const props = renderPanel({ hasProtocol: true, preview: "offline" });
    expect(screen.getByRole("button", { name: "Sample data (offline)" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Call endpoint (live)" }));
    expect(props.onPreviewChange).toHaveBeenCalledWith("live");
  });

  it("without a protocol the preview row is absent and the proto hint shows", () => {
    renderPanel({ hasProtocol: false });
    expect(screen.queryByRole("button", { name: "Call endpoint (live)" })).toBeNull();
    expect(screen.getByText(/With a protocol the resource is queryable/)).toBeTruthy();
  });

  it("renders the fields summary line", () => {
    renderPanel();
    expect(screen.getByText("7 fields — edit display in the Columns tab")).toBeTruthy();
  });
});
