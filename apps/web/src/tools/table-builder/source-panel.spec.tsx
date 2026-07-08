import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourcePanel } from "./source-panel";

const LABELS = {
  title: "Data source",
  rows: "Static rows",
  fetcher: "Fake fetcher",
  offset: "Offset",
  page: "Page",
  cursor: "Cursor",
};

describe("SourcePanel", () => {
  it("switching from rows to fetcher reports the default offset strategy", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="rows" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.fetcher }));

    expect(onModeChange).toHaveBeenCalledWith("offset");
  });

  it("does not render the strategy switch in rows mode", () => {
    render(<SourcePanel mode="rows" onModeChange={vi.fn()} labels={LABELS} />);

    expect(screen.queryByRole("button", { name: LABELS.offset })).toBeNull();
    expect(screen.queryByRole("button", { name: LABELS.page })).toBeNull();
    expect(screen.queryByRole("button", { name: LABELS.cursor })).toBeNull();
  });

  it("shows the strategy switch in fetcher mode and reports the selected strategy", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="offset" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.page }));

    expect(onModeChange).toHaveBeenCalledWith("page");
  });

  it("clicking static rows switches back to rows mode from any strategy", () => {
    const onModeChange = vi.fn();
    render(<SourcePanel mode="cursor" onModeChange={onModeChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: LABELS.rows }));

    expect(onModeChange).toHaveBeenCalledWith("rows");
  });
});
