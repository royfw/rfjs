import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TableConfig } from "@rfjs/table-builder";
import type { RequestMeta } from "@rfjs/data-schema";

import { MetadataPanel } from "./metadata-panel";

const LABELS = { hint: "hint text", copy: "Copy", copied: "Copied", download: "Download meta.json" };
const CONFIG: TableConfig = {
  columns: [{ key: "price", label: "Price", dataType: "numeric", pin: "left" }],
  pagination: { pageSize: 5 },
};
const REQUEST: RequestMeta = {
  endpoint: "/api/items",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
};

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  // jsdom has no createObjectURL; stub the pair the download anchor uses.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

describe("MetadataPanel", () => {
  it("renders the projected meta JSON (fields present, display-only pin dropped)", () => {
    render(<MetadataPanel config={CONFIG} labels={LABELS} />);

    const pre = screen.getByTestId("metadata-json");
    expect(pre.textContent).toContain('"fields"');
    expect(pre.textContent).toContain('"price"');
    expect(pre.textContent).not.toContain('"pin"');
    expect(pre.textContent).not.toContain('"request"');
  });

  it("includes request when provided", () => {
    render(<MetadataPanel config={CONFIG} request={REQUEST} labels={LABELS} />);
    expect(screen.getByTestId("metadata-json").textContent).toContain('"endpoint"');
  });

  it("copy writes the JSON to the clipboard and flips the button label", async () => {
    render(<MetadataPanel config={CONFIG} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"fields"'));
  });

  it("download builds a json blob url and clicks an anchor", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<MetadataPanel config={CONFIG} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "Download meta.json" }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    click.mockRestore();
  });
});
