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

  it("Enter 觸發產生;IME 組字中的 Enter(isComposing)不觸發", async () => {
    mockRun.mockResolvedValue('{"logic":"and","filters":[]}');
    renderBlock();
    const input = screen.getByPlaceholderText(/describe a filter/i);
    fireEvent.change(input, { target: { value: "篩出成年人" } });
    // 組字確認的 Enter:不得觸發
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(mockRun).not.toHaveBeenCalled();
    // Shift+Enter = 換行:不得觸發
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(mockRun).not.toHaveBeenCalled();
    // 一般 Enter:觸發
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(mockRun).toHaveBeenCalledTimes(1));
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

  it("空輸入:generate 與 ask 均 disabled;explain 可按", () => {
    renderBlock();
    expect((screen.getByRole("button", { name: /^generate$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /^ask$/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /explain current filter/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("AiAssistBlock — 持久化 / 清除 / 狀態", () => {
  it("掛載時從 log 還原堆疊(最新在上)", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        { id: "1", kind: "explain", answer: "第一則", at: "2026-07-08T00:00:00.000Z" },
        { id: "2", kind: "explain", answer: "第二則", at: "2026-07-08T00:00:01.000Z" },
      ]),
    );
    renderBlock();
    const answers = await screen.findAllByText(/第[一二]則/);
    expect(answers[0]!.textContent).toBe("第二則"); // 最新在上
  });

  it("清除:堆疊清空且 localStorage 移除", async () => {
    localStorage.setItem(LOG_KEY, JSON.stringify([{ id: "1", kind: "explain", answer: "x", at: "2026-07-08T00:00:00.000Z" }]));
    renderBlock();
    await screen.findByText("x");
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(screen.queryByText("x")).toBeNull();
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });

  it("未設定:三顆動作按鈕 disabled + 引導文案", () => {
    mockReady = false;
    renderBlock();
    expect(screen.getByText(/set up an ai connection/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /explain current filter/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("loading:顯示取消按鈕,按下呼叫 cancel", () => {
    mockLoading = true;
    renderBlock();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockCancel).toHaveBeenCalled();
  });

  it("收合:點標題隱藏內容並存偏好;預設依 localStorage 還原", async () => {
    renderBlock();
    const toggle = screen.getByRole("button", { name: /ai assist/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByPlaceholderText(/describe a filter/i)).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByPlaceholderText(/describe a filter/i)).toBeNull();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("0");
    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText(/describe a filter/i)).toBeTruthy();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("1");
  });

  it("收合偏好為 0 時,掛載即收合", async () => {
    localStorage.setItem("rfjs.ai.block.open", "0");
    renderBlock();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /ai assist/i }).getAttribute("aria-expanded")).toBe("false"),
    );
    expect(screen.queryByPlaceholderText(/describe a filter/i)).toBeNull();
  });

  it("parse 錯誤:alert 顯示 [parse] 且附原始輸出摺疊", () => {
    mockError = { kind: "parse", message: "bad", detail: '{"raw":1}' };
    renderBlock();
    expect(screen.getByRole("alert").textContent).toMatch(/\[parse\] bad/);
    expect(screen.getByText(/view raw output/i)).toBeTruthy();
    expect(screen.getByText('{"raw":1}')).toBeTruthy();
  });
});
