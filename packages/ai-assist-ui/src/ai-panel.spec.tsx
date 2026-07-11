import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiAssistEntry } from "@rfjs/ai-assist";
import { AiPanel, type AiPanelAction, type AiPanelLabels } from "./ai-panel";

const LABELS: AiPanelLabels = {
  kindGenerate: "Generate",
  kindAsk: "Ask",
  kindExplain: "Explain",
  kindCheck: "Check",
  cancel: "Cancel",
  notConfigured: "Set up an AI connection first (top-right ✨).",
  viewRaw: "View raw output",
  thinking: "Thinking…",
  answers: "AI answers",
  advisory: "AI suggestions, not engine verdicts",
  clear: "Clear",
  reapply: "Re-apply",
};

const mockCancel = vi.fn();
let mockReady = true;
let mockLoading = false;
let mockError: { kind: string; message: string; detail?: string } | null = null;
let mockStreamText = "";
let mockStreamReasoning = "";
const fakeAi = () =>
  ({
    ready: mockReady,
    loading: mockLoading,
    error: mockError,
    cancel: mockCancel,
    run: vi.fn(),
    runStream: vi.fn(),
    streamText: mockStreamText,
    streamReasoning: mockStreamReasoning,
  }) as never;

const LOG_KEY = "rfjs.ai.log.panel-spec";
const askRun =
  vi.fn<(input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>>();
const explainRun =
  vi.fn<(input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>>();

function actions(): AiPanelAction[] {
  return [
    {
      key: "ask",
      label: "Ask it",
      needsInput: true,
      primary: true,
      run: askRun,
    },
    { key: "explain", label: "Explain it", run: explainRun },
  ];
}

function renderPanel(extra: Partial<Parameters<typeof AiPanel>[0]> = {}) {
  return render(
    <AiPanel
      title="AI assist"
      placeholder="type here…"
      actions={actions()}
      logKey={LOG_KEY}
      ai={fakeAi()}
      labels={LABELS}
      {...extra}
    />,
  );
}

beforeEach(() => {
  localStorage.clear();
  askRun.mockReset();
  explainRun.mockReset();
  mockCancel.mockReset();
  mockReady = true;
  mockLoading = false;
  mockError = null;
  mockStreamText = "";
  mockStreamReasoning = "";
});

describe("AiPanel — 動作與輸入", () => {
  it("needsInput 動作在空輸入時 disabled；免輸入動作可按", () => {
    renderPanel();
    expect(
      (screen.getByRole("button", { name: /^ask it$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /^explain it$/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("run 回 entry → 落地堆疊並寫 localStorage、輸入清空；回 null → 不落地", async () => {
    askRun.mockResolvedValue({ kind: "ask", prompt: "q1", answer: "a1" });
    renderPanel();
    const input = screen.getByPlaceholderText("type here…");
    fireEvent.change(input, { target: { value: "q1" } });
    fireEvent.click(screen.getByRole("button", { name: /^ask it$/i }));
    await waitFor(() => expect(screen.getByText("a1")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toHaveLength(1);
    expect((input as HTMLTextAreaElement).value).toBe("");

    explainRun.mockResolvedValue(null);
    fireEvent.click(screen.getByRole("button", { name: /^explain it$/i }));
    await waitFor(() => expect(explainRun).toHaveBeenCalled());
    expect(JSON.parse(localStorage.getItem(LOG_KEY)!)).toHaveLength(1); // 不變
  });

  it("Enter 觸發第一個 needsInput 動作；isComposing / Shift+Enter / loading 不觸發", async () => {
    askRun.mockResolvedValue({ kind: "ask", prompt: "q", answer: "a" });
    renderPanel();
    const input = screen.getByPlaceholderText("type here…");
    fireEvent.change(input, { target: { value: "q" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(askRun).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(askRun).toHaveBeenCalledTimes(1));
  });

  it("loading：顯示取消並可呼叫 cancel；動作 disabled", () => {
    mockLoading = true;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockCancel).toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: /^explain it$/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("未設定：動作 disabled + 引導文案", () => {
    mockReady = false;
    renderPanel();
    expect(screen.getByText(/set up an ai connection/i)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: /^explain it$/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("parse 錯誤：alert 顯示 [parse] 且附原始輸出摺疊", () => {
    mockError = { kind: "parse", message: "bad", detail: '{"raw":1}' };
    renderPanel();
    expect(screen.getByRole("alert").textContent).toMatch(/\[parse\] bad/);
    expect(screen.getByText(/view raw output/i)).toBeTruthy();
    expect(screen.getByText('{"raw":1}')).toBeTruthy();
  });

  it("串流中：顯示即時回覆與可摺疊的思考區；非串流（streamText 空）不顯示", () => {
    mockLoading = true;
    mockStreamText = "streaming answer…";
    mockStreamReasoning = "step 1";
    const { rerender } = renderPanel();
    expect(screen.getByText("streaming answer…")).toBeTruthy();
    expect(screen.getByText(/thinking/i)).toBeTruthy();
    expect(screen.getByText("step 1")).toBeTruthy();
    mockStreamText = "";
    mockStreamReasoning = "";
    rerender(
      <AiPanel
        title="AI assist"
        placeholder="type here…"
        actions={actions()}
        logKey={LOG_KEY}
        ai={fakeAi()}
        labels={LABELS}
      />,
    );
    expect(screen.queryByText(/thinking/i)).toBeNull();
  });
});

describe("AiPanel — 收合 / 持久化 / 重新套用", () => {
  it("收合：點標題隱藏內容並存偏好；再點展開存 1", async () => {
    renderPanel();
    const toggle = screen.getByRole("button", { name: /ai assist/i });
    fireEvent.click(toggle);
    expect(screen.queryByPlaceholderText("type here…")).toBeNull();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("0");
    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText("type here…")).toBeTruthy();
    expect(localStorage.getItem("rfjs.ai.block.open")).toBe("1");
  });

  it("偏好 0 時掛載即收合（effect 還原，需 waitFor）", async () => {
    localStorage.setItem("rfjs.ai.block.open", "0");
    renderPanel();
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /ai assist/i })
          .getAttribute("aria-expanded"),
      ).toBe("false"),
    );
    expect(screen.queryByPlaceholderText("type here…")).toBeNull();
  });

  it("掛載還原堆疊（最新在上）；清除清空 localStorage", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: "1",
          kind: "explain",
          answer: "第一則",
          at: "2026-07-08T00:00:00.000Z",
        },
        {
          id: "2",
          kind: "explain",
          answer: "第二則",
          at: "2026-07-08T00:00:01.000Z",
        },
      ]),
    );
    renderPanel();
    const items = await screen.findAllByText(/第[一二]則/);
    expect(items[0]!.textContent).toBe("第二則");
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(localStorage.getItem(LOG_KEY)).toBeNull();
  });

  it("onReapply + appliedJson 才顯示重新套用，點擊帶正確 entry；appliedSummary 呈現", async () => {
    const onReapply = vi.fn();
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: "g1",
          kind: "generate",
          prompt: "p",
          appliedJson: "{}",
          at: "2026-07-08T00:00:00.000Z",
        },
        {
          id: "e1",
          kind: "explain",
          answer: "x",
          at: "2026-07-08T00:00:01.000Z",
        },
      ]),
    );
    renderPanel({ onReapply, appliedSummary: () => "applied summary!" });
    await screen.findByText("applied summary!");
    const btns = screen.getAllByRole("button", { name: /^re-apply$/i });
    expect(btns).toHaveLength(1);
    fireEvent.click(btns[0]!);
    expect(onReapply).toHaveBeenCalledWith(
      expect.objectContaining({ id: "g1" }),
    );
  });

  it("未給 onReapply：有 appliedJson 也不顯示按鈕", async () => {
    localStorage.setItem(
      LOG_KEY,
      JSON.stringify([
        {
          id: "g1",
          kind: "generate",
          prompt: "p",
          appliedJson: "{}",
          at: "2026-07-08T00:00:00.000Z",
        },
      ]),
    );
    renderPanel({ appliedSummary: () => "s" });
    await screen.findByText("s");
    expect(screen.queryByRole("button", { name: /^re-apply$/i })).toBeNull();
  });
});
