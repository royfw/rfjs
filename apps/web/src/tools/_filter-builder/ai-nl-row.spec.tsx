import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

const mockRun = vi.fn();
let mockError: { kind: string; message: string; detail?: string } | null = null;
vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({ ready: true, loading: false, error: mockError, cancel: vi.fn(), run: mockRun }),
}));

import { AiNlRow } from "./ai-nl-row";

function renderRow(onApply = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiNlRow schema={[]} onApply={onApply} />
    </NextIntlClientProvider>,
  );
  return onApply;
}

describe("AiNlRow", () => {
  it("runs the assist and applies the returned canonical json", async () => {
    mockRun.mockResolvedValue('{\n  "logic": "and",\n  "filters": []\n}');
    const onApply = renderRow();
    fireEvent.change(screen.getByPlaceholderText(/describe the filter/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /ai generate/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.stringContaining('"logic"')));
  });

  it("does not apply when the run returns null (error path)", async () => {
    mockRun.mockResolvedValue(null);
    const onApply = renderRow();
    fireEvent.change(screen.getByPlaceholderText(/describe the filter/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /ai generate/i }));
    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows a collapsible raw-output view for parse errors with detail", () => {
    mockError = { kind: "parse", message: "the AI response is not valid JSON", detail: "not json at all" };
    renderRow();
    expect(screen.getByRole("alert").textContent).toContain("[parse] the AI response is not valid JSON");
    expect(screen.getByText("View raw output")).toBeTruthy();
    expect(screen.getByText("not json at all")).toBeTruthy();
    mockError = null;
  });

  it("does not show a raw-output view for non-parse errors", () => {
    mockError = { kind: "http", message: "request failed" };
    renderRow();
    expect(screen.getByRole("alert").textContent).toContain("[http] request failed");
    expect(screen.queryByText("View raw output")).toBeNull();
    mockError = null;
  });
});
