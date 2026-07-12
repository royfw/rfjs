import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockCancel = vi.fn();

vi.mock("@rfjs/ai-assist-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rfjs/ai-assist-ui")>()),
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
    const pageSizeSelect = screen.getByLabelText(
      /rows per page/i,
    ) as HTMLSelectElement;
    fireEvent.change(pageSizeSelect, { target: { value: "10" } });

    await screen.findByText(/Page 1 of 2/);
    expect(screen.getByText(/18 rows/)).toBeTruthy();
  });

  it("renders SAMPLE_CONFIG's pageSize rows by default (sample resource, offline preview)", async () => {
    renderTool();

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + SAMPLE_CONFIG.pagination.pageSize);
    });
  });

  it("toggling the protocol off falls back to static rows (still renders)", async () => {
    renderTool();
    // default = sample resource with protocol -> the declare-protocol switch is ON
    fireEvent.click(await screen.findByRole("switch", { name: "declare protocol" }));

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + SAMPLE_CONFIG.pagination.pageSize);
    });
    // without a protocol there is no offline/live preview toggle
    expect(screen.queryByRole("button", { name: /call endpoint/i })).toBeNull();
  });

  it("editing page size in the pagination panel immediately changes the rendered row count", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Pagination" }));
    const pageSizeInput = screen.getByLabelText(
      "Default page size",
    ) as HTMLInputElement;
    fireEvent.change(pageSizeInput, { target: { value: "3" } });

    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows.length).toBe(1 + 3);
    });
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
  it("tabs swap the editor panel while the preview table stays visible", async () => {
    renderTool();

    // default tab = Source
    expect(screen.getByText("Data resource")).toBeTruthy();
    expect(screen.queryByLabelText("Default page size")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Columns" }));
    expect(screen.queryByText("Data resource")).toBeNull();
    expect(screen.getByText("Columns", { selector: "p" })).toBeTruthy();
    // preview still rendered
    await waitFor(() => expect(screen.getAllByRole("row").length).toBeGreaterThan(1));
  });

  it("metadata tab carries the protocol by default and drops it when the protocol is off", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    const pre = screen.getByTestId("metadata-json");
    expect(pre.textContent).toContain('"fields"');
    expect(pre.textContent).toContain('"request"');

    // turn the protocol off (switch lives on the Resource tab)
    fireEvent.click(screen.getByRole("button", { name: "Resource" }));
    fireEvent.click(screen.getByRole("switch", { name: "declare protocol" }));
    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    expect(screen.getByTestId("metadata-json").textContent).not.toContain('"request"');
  });

  it('fetcher mode: filter section is enabled and offers an Apply button', async () => {
    renderTool();

    const toggle = await screen.findByRole('button', { name: /filter/i });
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(toggle);
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeTruthy();
  });

  it("renders the protocol editor with an editable endpoint by default", async () => {
    renderTool();
    expect(await screen.findByDisplayValue("/api/query/sample")).toBeTruthy();
  });

  it("importing rows seeds a protocol-less resource (offline preview queries the imported rows)", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Paste rows" }));
    fireEvent.change(screen.getByPlaceholderText("Paste JSON or CSV…"), {
      target: { value: '[{"name":"Imported Row"}]' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    await screen.findByText("Imported Row");
    // rows import clears the protocol -> switch off, no preview toggle
    expect((screen.getByRole("switch", { name: "declare protocol" }) as HTMLInputElement).getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByRole("button", { name: /call endpoint/i })).toBeNull();
  });

  it("offline preview shows the offline/live toggle when the protocol is on", async () => {
    renderTool();
    expect(await screen.findByRole("button", { name: "Sample data (offline)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Call endpoint (live)" })).toBeTruthy();
  });

  it("importing a meta.json seeds fields + protocol end-to-end", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import meta.json" }));
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta (meta.json)…"), {
      target: {
        value: JSON.stringify({
          fields: [{ key: "name", label: "Name", dataType: "string" }],
          request: {
            endpoint: "/api/query/imported",
            method: "GET",
            pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
          },
          response: { rowsPath: "data.items" },
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    // protocol carried in: endpoint editable in the ProtocolPanel, switch stays on
    expect(await screen.findByDisplayValue("/api/query/imported")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "declare protocol" }).getAttribute("aria-checked")).toBe("true");
  });

  it("importing a meta.json with a partial protocol (request only) treats it as protocol-less", async () => {
    renderTool();

    fireEvent.click(screen.getByRole("button", { name: "Import meta.json" }));
    fireEvent.change(screen.getByPlaceholderText("Paste a DataResourceMeta (meta.json)…"), {
      target: {
        value: JSON.stringify({
          fields: [{ key: "name", label: "Name", dataType: "string" }],
          request: {
            endpoint: "/api/query/partial",
            method: "GET",
            pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
          },
          // no response -> half a protocol
        }),
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "declare protocol" }).getAttribute("aria-checked")).toBe("false");
    });
    // the half must not leak into the Metadata tab
    fireEvent.click(screen.getByRole("button", { name: "Metadata" }));
    expect(screen.getByTestId("metadata-json").textContent).not.toContain('"request"');
  });

  it("renders the collapsible ToolIntro and expands to the concepts", () => {
    renderTool();
    const header = screen.getByRole("button", { name: /how does this tool work/i });
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/A DataResourceMeta\. Seed it/)).toBeNull();
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/A DataResourceMeta\. Seed it/)).toBeTruthy();
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

    fireEvent.change(
      screen.getByPlaceholderText("Describe a table change or ask a question…"),
      {
        target: { value: "rename id" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate config" }));

    // preview header reflects the applied config
    await screen.findByText("Renamed Column");
    // applied summary shows the column count
    await screen.findByText("Applied (1 columns)");
  });

  it("ask records a plain answer entry", async () => {
    mockRun.mockResolvedValue("It lists products with prices.");
    renderTool();

    fireEvent.change(
      screen.getByPlaceholderText("Describe a table change or ask a question…"),
      {
        target: { value: "what does this table show?" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await screen.findByText("It lists products with prices.");
  });
});
