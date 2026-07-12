import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourcePanel } from "./source-panel";

const LABELS = {
  title: "Data source",
  rows: "Static rows",
  fetcher: "Fake fetcher",
  transport: "Transport",
  transportMemory: "in-memory",
  transportHttp: "HTTP",
};

const FULL_LABELS = {
  title: "Data source",
  rows: "Static rows",
  fetcher: "Remote",
  transport: "Transport",
  transportMemory: "in-memory",
  transportHttp: "HTTP",
};

const IMPORT_LABELS = {
  paste: "Paste JSON or CSV…",
  upload: "Upload .json/.csv",
  load: "Load",
  json: "JSON",
  csv: "CSV",
};

describe("SourcePanel", () => {
  it("switching from rows to fetcher reports remote mode", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="rows" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.fetcher }));

    expect(onModeChange).toHaveBeenCalledWith("remote");
  });

  it("pre-fills the paste box with defaultText", () => {
    render(
      <SourcePanel
        mode="rows"
        onModeChange={vi.fn()}
        labels={LABELS}
        importLabels={IMPORT_LABELS}
        onImport={vi.fn()}
        defaultText='[{"a":1}]'
      />,
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe('[{"a":1}]');
  });

  it("clicking static rows switches back to rows mode from remote", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="remote" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.rows }));

    expect(onModeChange).toHaveBeenCalledWith("rows");
  });

  it("does not render the import UI in fetcher mode", () => {
    render(
      <SourcePanel mode="remote" onModeChange={vi.fn()} labels={LABELS} onImport={vi.fn()} importLabels={IMPORT_LABELS} />,
    );

    expect(screen.queryByPlaceholderText(IMPORT_LABELS.paste)).toBeNull();
    expect(screen.queryByRole("button", { name: IMPORT_LABELS.load })).toBeNull();
  });

  it("renders a label-wrapped file input for upload, not a button (no accessible-name collision with Load)", () => {
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={vi.fn()} importLabels={IMPORT_LABELS} />,
    );

    expect(screen.getByRole("button", { name: IMPORT_LABELS.load })).not.toBeNull();
    expect(screen.queryByRole("button", { name: IMPORT_LABELS.upload })).toBeNull();
    const fileInput = screen.getByText(IMPORT_LABELS.upload).closest("label")?.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
  });

  it("loading valid pasted JSON reports the parsed rows", () => {
    const onImport = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={onImport} importLabels={IMPORT_LABELS} />,
    );

    fireEvent.change(screen.getByPlaceholderText(IMPORT_LABELS.paste), { target: { value: '[{"a":1}]' } });
    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.load }));

    expect(onImport).toHaveBeenCalledWith([{ a: 1 }]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("loading invalid pasted content shows an error and does not call onImport", () => {
    const onImport = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={onImport} importLabels={IMPORT_LABELS} />,
    );

    fireEvent.change(screen.getByPlaceholderText(IMPORT_LABELS.paste), { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.load }));

    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).not.toBeNull();
  });

  it("switching to CSV and loading valid pasted CSV reports typed rows", () => {
    const onImport = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} onImport={onImport} importLabels={IMPORT_LABELS} />,
    );

    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.csv }));
    fireEvent.change(screen.getByPlaceholderText(IMPORT_LABELS.paste), { target: { value: "a,b\n1,x" } });
    fireEvent.click(screen.getByRole("button", { name: IMPORT_LABELS.load }));

    expect(onImport).toHaveBeenCalledWith([{ a: 1, b: "x" }]);
  });
});

describe("SourcePanel transport toggle", () => {
  it("shows a transport toggle only when remote, and reports changes", () => {
    const onTransportChange = vi.fn();
    const { rerender } = render(
      <SourcePanel mode="rows" onModeChange={() => {}} labels={FULL_LABELS} transport="memory" onTransportChange={onTransportChange} />,
    );
    expect(screen.queryByRole("button", { name: FULL_LABELS.transportHttp })).toBeNull();
    rerender(
      <SourcePanel mode="remote" onModeChange={() => {}} labels={FULL_LABELS} transport="memory" onTransportChange={onTransportChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: FULL_LABELS.transportHttp }));
    expect(onTransportChange).toHaveBeenCalledWith("http");
  });

  it("fetcher toggle -> remote, no strategy row, transport labels from labels", () => {
    const onModeChange = vi.fn();
    render(
      <SourcePanel mode="rows" onModeChange={onModeChange} labels={FULL_LABELS} transport="memory" onTransportChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: FULL_LABELS.fetcher }));
    expect(onModeChange).toHaveBeenCalledWith("remote");
    expect(screen.queryByRole("button", { name: /^offset$/i })).toBeNull();

    render(
      <SourcePanel mode="remote" onModeChange={() => {}} labels={FULL_LABELS} transport="memory" onTransportChange={() => {}} />,
    );
    expect(screen.getByRole("button", { name: FULL_LABELS.transportHttp })).toBeTruthy();
  });
});
