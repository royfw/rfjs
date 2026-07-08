import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaginationPanel } from "./pagination-panel";

const LABELS = { title: "Pagination", pageSize: "Default page size", emptyText: "Empty state text" };

describe("PaginationPanel", () => {
  it("editing the page size input reports the numeric value", () => {
    const onPaginationChange = vi.fn();
    render(
      <PaginationPanel
        pagination={{ pageSize: 5 }}
        onPaginationChange={onPaginationChange}
        onEmptyTextChange={vi.fn()}
        labels={LABELS}
      />,
    );

    fireEvent.change(screen.getByLabelText(LABELS.pageSize), { target: { value: "20" } });

    expect(onPaginationChange).toHaveBeenCalledWith({ pageSize: 20 });
  });

  it("preserves pageSizeOptions when only pageSize is edited", () => {
    const onPaginationChange = vi.fn();
    render(
      <PaginationPanel
        pagination={{ pageSize: 5, pageSizeOptions: [5, 10, 20] }}
        onPaginationChange={onPaginationChange}
        onEmptyTextChange={vi.fn()}
        labels={LABELS}
      />,
    );

    fireEvent.change(screen.getByLabelText(LABELS.pageSize), { target: { value: "10" } });

    expect(onPaginationChange).toHaveBeenCalledWith({ pageSize: 10, pageSizeOptions: [5, 10, 20] });
  });

  it("editing the empty text input reports the string value", () => {
    const onEmptyTextChange = vi.fn();
    render(
      <PaginationPanel
        pagination={{ pageSize: 5 }}
        onPaginationChange={vi.fn()}
        onEmptyTextChange={onEmptyTextChange}
        labels={LABELS}
      />,
    );

    fireEvent.change(screen.getByLabelText(LABELS.emptyText), { target: { value: "Nothing here" } });

    expect(onEmptyTextChange).toHaveBeenCalledWith("Nothing here");
  });
});
