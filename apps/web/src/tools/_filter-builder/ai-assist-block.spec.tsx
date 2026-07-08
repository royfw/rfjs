import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import type { FieldSchema } from "@rfjs/filter-builder";

const mockRun = vi.fn();
const mockCancel = vi.fn();
let mockReady = true;
let mockLoading = false;
let mockError: { kind: string; message: string; detail?: string } | null = null;

vi.mock("@/lib/ai/use-ai-assist", () => ({
  useAiAssist: () => ({ ready: mockReady, loading: mockLoading, error: mockError, cancel: mockCancel, run: mockRun }),
}));

import { AiAssistBlock } from "./ai-assist-block";

const SCHEMA: FieldSchema[] = [{ path: "age", dataType: "numeric", include: true, kind: "jsonb" }];
const LOG_KEY = "rfjs.ai.log.spec-tool";

function renderBlock(onApply = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiAssistBlock
        schema={SCHEMA}
        canonicalJson='{"logic":"and","filters":[]}'
        compiled={"WHERE 1=1"}
        engineId="pg-filter"
        onApply={onApply}
        logKey={LOG_KEY}
      />
    </NextIntlClientProvider>,
  );
  return onApply;
}

beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
  mockCancel.mockReset();
  mockReady = true;
  mockLoading = false;
  mockError = null;
});

describe("AiAssistBlock — generate(既有行為遷移)", () => {
  it("成功:onApply 收到 parse 後結果、堆疊出現 generate 項、寫入 localStorage", async () => {
    const json = '{\n  "logic": "and",\n  "filters": []\n}';
    mockRun.mockResolvedValue(json);
    const onApply = renderBlock();
    fireEvent.change(screen.getByPlaceholderText(/describe a filter/i), { target: { value: "active users" } });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(json));
    expect(screen.getByText(/applied \(0 conditions\)/i)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toHaveLength(1);
    // 產生 prompt 帶入目前樹(接續組合:「且…」描述會合併而非整棵重建)
    expect(mockRun.mock.calls[0]![0].system).toContain('{"logic":"and","filters":[]}');
  });

  it("失敗(run 回 null):onApply 不被呼叫、堆疊不變", async () => {
    mockRun.mockResolvedValue(null);
    const onApply = renderBlock();
    fireEvent.change(screen.getByPlaceholderText(/describe a filter/i), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    await waitFor(() => expect(mockRun).toHaveBeenCalled());
    expect(onApply).not.toHaveBeenCalled();
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });
});

describe("AiAssistBlock — ask / explain", () => {
  it("提問:堆疊出現問題+回答(display-only,不呼叫 onApply)", async () => {
    mockRun.mockResolvedValue("可以,條件會…");
    const onApply = renderBlock();
    fireEvent.change(screen.getByPlaceholderText(/describe a filter/i), { target: { value: "能挑出活躍嗎?" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    await waitFor(() => expect(screen.getByText("可以,條件會…")).toBeTruthy());
    expect(screen.getByText("能挑出活躍嗎?")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    // ask 走非 JSON 模式
    expect(mockRun.mock.calls[0]![0].json).toBeUndefined();
  });

  it("解釋:免輸入可按、堆疊出現回答", async () => {
    mockRun.mockResolvedValue("這組條件會選出…");
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: /explain current filter/i }));
    await waitFor(() => expect(screen.getByText("這組條件會選出…")).toBeTruthy());
  });
});

describe("AiAssistBlock — 重新套用", () => {
  it("預置一筆完整 generate entry → 顯示 Re-apply,點擊帶回該 JSON", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: "g1",
          kind: "generate",
          prompt: "p",
          appliedJson: '{"logic":"and","filters":[]}',
          at: "2026-07-08T00:00:00.000Z",
        },
      ]),
    );
    const onApply = renderBlock();
    const btn = await screen.findByRole("button", { name: /^re-apply$/i });
    fireEvent.click(btn);
    expect(onApply).toHaveBeenCalledWith('{"logic":"and","filters":[]}');
  });

  it("已套用摘要:generate 項顯示 applied (0 conditions)", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: "g1",
          kind: "generate",
          prompt: "p",
          appliedJson: '{"logic":"and","filters":[]}',
          at: "2026-07-08T00:00:00.000Z",
        },
      ]),
    );
    renderBlock();
    expect(await screen.findByText(/applied \(0 conditions\)/i)).toBeTruthy();
  });
});
