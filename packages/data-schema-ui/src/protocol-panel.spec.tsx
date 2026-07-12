import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProtocolPanel } from "./protocol-panel";
import type { RequestMeta, ResponseMeta } from "@rfjs/data-schema";

const LABELS = {
  enabled: "declare protocol", endpoint: "endpoint", method: "method", pagination: "pagination",
  sort: "sort", sortNone: "no sort", filter: "filter", filterNone: "none", filterParam: "filter param",
  rowsPath: "rowsPath", totalPath: "totalPath", cursorPath: "cursorPath",
  limitParam: "limitParam", offsetParam: "offsetParam", pageParam: "pageParam", pageSizeParam: "pageSizeParam",
  firstPage: "firstPage", cursorParam: "cursorParam", sortParam: "sort param", encoding: "encoding",
  fieldParam: "fieldParam", dirParam: "dirParam",
  try: "Try", tryRows: "{count} rows", tryError: "Request failed",
};

const REQUEST: RequestMeta = {
  endpoint: "/api/items",
  method: "POST",
  pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" },
  filter: { style: "pg", param: "filter" },
};
const RESPONSE: ResponseMeta = { rowsPath: "data.items", totalPath: "data.total" };

describe("ProtocolPanel", () => {
  it("toggling the enable switch off reports undefined request/response", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("switch", { name: "declare protocol" }));

    expect(onChange).toHaveBeenCalledWith({ request: undefined, response: undefined });
  });

  it("toggling on from empty seeds a minimal offset request + response", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={undefined} response={undefined} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("switch", { name: "declare protocol" }));

    const next = onChange.mock.calls[0]![0];
    expect(next.request.endpoint).toBe("/api/query/sample");
    expect(next.request.pagination.strategy).toBe("offset");
    expect(next.response.rowsPath).toBe("data.items");
  });

  it("switching pagination strategy swaps the param inputs and rewrites pagination", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "cursor" }));

    const next = onChange.mock.calls[0]![0];
    expect(next.request.pagination).toEqual({ strategy: "cursor", cursorParam: "cursor", limitParam: "limit" });
  });

  it("editing endpoint and filter param write through", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.change(screen.getByLabelText("endpoint"), { target: { value: "/api/x" } });
    expect(onChange.mock.calls[0]![0].request.endpoint).toBe("/api/x");

    fireEvent.change(screen.getByLabelText("filter param"), { target: { value: "q" } });
    expect(onChange.mock.calls[1]![0].request.filter).toEqual({ style: "pg", param: "q" });
  });

  it("selecting filter none removes the filter declaration", () => {
    const onChange = vi.fn();
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={onChange} labels={LABELS} />);

    fireEvent.click(screen.getByRole("button", { name: "none" }));

    expect(onChange.mock.calls[0]![0].request.filter).toBeUndefined();
  });

  it("hides the enable Switch when showEnableToggle is false, always shows fields", () => {
    render(<ProtocolPanel request={REQUEST} response={RESPONSE} onChange={() => {}} labels={LABELS} showEnableToggle={false} />);
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getByDisplayValue(REQUEST.endpoint)).toBeTruthy();
  });
});

describe("ProtocolPanel try endpoint", () => {
  const req = {
    endpoint: "/api/query/sample",
    method: "GET" as const,
    pagination: { strategy: "offset" as const, limitParam: "limit", offsetParam: "offset" },
    filter: { style: "pg" as const, param: "filter" },
  };
  const res = { rowsPath: "data.items", totalPath: "data.total" };

  it("fires the request and shows the row count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { items: [{ id: 1 }, { id: 2 }], total: 2 } }) }));
    render(<ProtocolPanel request={req} response={res} onChange={() => {}} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: /try|試打/i }));
    // 斷言 count span 專屬字串 "2 rows"(LABELS.tryRows="{count} rows".replace → "2 rows");
    // 原始 JSON <pre> 不含 "2 rows",避免 findByText 多重匹配。
    expect(await screen.findByText(/2 rows/)).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it("shows an error when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    render(<ProtocolPanel request={req} response={res} onChange={() => {}} labels={LABELS} />);
    fireEvent.click(screen.getByRole("button", { name: /try|試打/i }));
    expect(await screen.findByText(/boom/)).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
