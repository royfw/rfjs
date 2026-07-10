import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockCancel = vi.fn();

vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({
    ready: true,
    loading: false,
    error: null,
    cancel: mockCancel,
    run: mockRun,
    runStream: mockRun,
    streamText: "",
    streamReasoning: "",
  }),
}));

import { assembleMessages } from "@/i18n/messages";
import { SAMPLE_CONFIG } from "./sample";
import { TableBuilderTool } from "./ui";

beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
});

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
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

    fireEvent.click(screen.getByRole("button", { name: "Pagination" }));
    const pageSizeInput = screen.getByLabelText("Default page size") as HTMLInputElement;
    fireEvent.change(pageSizeInput, { target: { value: "3" } });

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(1 + 3);
  });

  // Smoke test only: real "add condition -> row count shrinks" behavior is covered by the e2e
  // suite (Task 8). Each column row also carries a "Filter" checkbox label (Task 5), so a bare
  // `getByText(/filter/i)` would match multiple nodes and throw -- scope to ConfigTable's own
  // collapsible filter-section toggle button (Task 4), whose accessible name is "Filter" (+
  // matched-count text).
  it("preview: renders the ConfigTable filter section", () => {
    renderTool();
    expect(screen.getByRole("button", { name: /filter/i })).toBeTruthy();
  });

  // B-layout (design spec §2.1): the editor panels are tabs; the preview table must stay
  // mounted below regardless of the active tab (the live edit→preview loop is the point).
  it("tabs swap the editor panel while the preview table stays visible", () => {
    renderTool();

    // default tab = Source
    expect(screen.getByText("Data source")).toBeTruthy();
    expect(screen.queryByLabelText("Default page size")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.queryByText("Data source")).toBeNull();
    expect(screen.getByText("Columns", { selector: "p" })).toBeTruthy();
    // preview still rendered
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("metadata tab shows the reverse-projected DataResourceMeta JSON", () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));

    const pre = screen.getByTestId("metadata-json");
    expect(pre.textContent).toContain('"fields"');
    // static rows mode carries no request protocol
    expect(pre.textContent).not.toContain('"request"');
  });

  it('fetcher mode: filter section is enabled and offers an Apply button', async () => {
    renderTool();
    fireEvent.click(screen.getByRole('button', { name: 'Fake fetcher' }));

    const toggle = await screen.findByRole('button', { name: /filter/i });
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(toggle);
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeTruthy();
  });
});

describe("TableBuilderTool AI panel", () => {
  it("generate applies the returned TableConfig to the live preview", async () => {
    // `ai.run` resolves with the ALREADY-VALIDATED normalized json (the real hook applies
    // parseNlTableResponse internally); the tool then parses + setConfig()s it.
    const generated = {
      columns: [{ key: "id", label: "Renamed Column", dataType: "numeric" }],
      pagination: { pageSize: 5 },
    };
    mockRun.mockResolvedValue(JSON.stringify(generated, null, 2));
    renderTool();

    fireEvent.change(screen.getByPlaceholderText("Describe a table change or ask a question…"), {
      target: { value: "rename id" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate config" }));

    // preview header reflects the applied config
    await screen.findByText("Renamed Column");
    // applied summary shows the column count
    await screen.findByText("Applied (1 columns)");
  });

  it("ask records a plain answer entry", async () => {
    mockRun.mockResolvedValue("It lists products with prices.");
    renderTool();

    fireEvent.change(screen.getByPlaceholderText("Describe a table change or ask a question…"), {
      target: { value: "what does this table show?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await screen.findByText("It lists products with prices.");
  });
});
