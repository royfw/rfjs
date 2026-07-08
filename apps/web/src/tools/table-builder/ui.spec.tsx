import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { messages } from "./messages";
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
});
