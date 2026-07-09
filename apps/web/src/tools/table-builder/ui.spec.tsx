import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
import { SAMPLE_CONFIG } from "./sample";
import { TableBuilderTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <TableBuilderTool />
    </NextIntlClientProvider>,
  );
}

describe("TableBuilderTool", () => {
  // Regression test for the next-intl placeholder trap (see PR #183 history): `tbPageOf` /
  // `tbTotalRows` carry raw `{page}`/`{count}`/`{total}` for ConfigTable's OWN substitution.
  // Calling them with bare `t()` makes next-intl ICU-parse the template and throw
  // FORMATTING_ERROR in a real browser (no values supplied) -- it must render the actual
  // substituted footer text, not next-intl's fallback.
  it("renders ConfigTable's real substituted pagination footer, not an ICU fallback", async () => {
    renderTool();

    // 18 sample rows; select a page size of 10 so the assertion (page 1 of 2) is unambiguous.
    const pageSizeSelect = screen.getByLabelText(/rows per page/i) as HTMLSelectElement;
    fireEvent.change(pageSizeSelect, { target: { value: "10" } });

    await screen.findByText(/Page 1 of 2/);
    expect(screen.getByText(/18 rows/)).toBeTruthy();
  });

  it("renders SAMPLE_CONFIG's pageSize rows by default (static source)", () => {
    renderTool();

    // one <tr> for the header + one per visible data row.
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(1 + SAMPLE_CONFIG.pagination.pageSize);
  });

  it("switching the data source to the fake fetcher (offset mode) still renders rows", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Fake fetcher" }));

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + SAMPLE_CONFIG.pagination.pageSize);
    });
  });

  it("editing page size in the pagination panel immediately changes the rendered row count", () => {
    renderTool();

    const pageSizeInput = screen.getByLabelText("Default page size") as HTMLInputElement;
    fireEvent.change(pageSizeInput, { target: { value: "3" } });

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(1 + 3);
  });
});
