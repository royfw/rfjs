import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";

const mockRun = vi.fn();
vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({ ready: true, loading: false, error: null, cancel: vi.fn(), run: mockRun }),
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
});
