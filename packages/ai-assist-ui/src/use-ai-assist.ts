"use client";

import * as React from "react";

import {
  AiError,
  createAiClient,
  isConfigured,
  loadAiSettings,
  subscribeAiSettings,
  type CompleteRequest,
} from "@rfjs/ai-assist";

export interface UseAiAssist {
  ready: boolean;
  loading: boolean;
  error: AiError | null;
  /** 串流進行中累積的回覆文字(非串流 run 期間為空)。 */
  streamText: string;
  /** 串流進行中累積的推理文字(模型/gateway 有透傳 reasoning_content 才有)。 */
  streamReasoning: string;
  cancel: () => void;
  run<T>(
    req: Omit<CompleteRequest, "signal">,
    parse: (raw: string) => T,
  ): Promise<T | null>;
  /** 同 run,但以 SSE 串流;過程更新 streamText/streamReasoning,完成後對完整文字 parse。 */
  runStream<T>(
    req: Omit<CompleteRequest, "signal">,
    parse: (raw: string) => T,
  ): Promise<T | null>;
}

export function useAiAssist(): UseAiAssist {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<AiError | null>(null);
  const [streamText, setStreamText] = React.useState("");
  const [streamReasoning, setStreamReasoning] = React.useState("");
  const ctlRef = React.useRef<AbortController | null>(null);
  // 訂閱設定變更 —— 設定 dialog 存檔後同分頁即時重繪(不必重新整理);SSR 回傳 false。
  const ready = React.useSyncExternalStore(
    subscribeAiSettings,
    () => isConfigured(loadAiSettings()),
    () => false,
  );

  const cancel = React.useCallback(() => {
    ctlRef.current?.abort();
  }, []);

  const run = React.useCallback(
    async <T>(
      req: Omit<CompleteRequest, "signal">,
      parse: (raw: string) => T,
    ): Promise<T | null> => {
      const settings = loadAiSettings();
      if (!isConfigured(settings)) {
        setError(new AiError("config", "AI connection is not configured"));
        return null;
      }
      ctlRef.current?.abort(); // 新 run 取消前一個
      const ctl = new AbortController();
      ctlRef.current = ctl;
      setLoading(true);
      setError(null);
      try {
        const raw = await createAiClient(settings).complete({
          ...req,
          signal: ctl.signal,
        });
        try {
          return parse(raw);
        } catch (e) {
          setError(
            new AiError(
              "parse",
              e instanceof Error ? e.message : String(e),
              raw,
            ),
          );
          return null;
        }
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError("http", String(e));
        if (err.kind !== "abort") setError(err); // 使用者取消不是錯誤
        return null;
      } finally {
        // 只有仍是「現任」的 run 才能結束 loading(被取代的舊 run 不得干擾新 run 的狀態)。
        if (ctlRef.current === ctl) {
          ctlRef.current = null;
          setLoading(false);
        }
      }
    },
    [],
  );

  const runStream = React.useCallback(
    async <T>(
      req: Omit<CompleteRequest, "signal">,
      parse: (raw: string) => T,
    ): Promise<T | null> => {
      const settings = loadAiSettings();
      if (!isConfigured(settings)) {
        setError(new AiError("config", "AI connection is not configured"));
        return null;
      }
      ctlRef.current?.abort();
      const ctl = new AbortController();
      ctlRef.current = ctl;
      setLoading(true);
      setError(null);
      setStreamText("");
      setStreamReasoning("");
      let text = "";
      let reasoning = "";
      try {
        const raw = await createAiClient(settings).stream(
          { ...req, signal: ctl.signal },
          (d) => {
            if (ctlRef.current !== ctl) return; // 被取代的舊 run 不得更新畫面
            if (d.content) {
              text += d.content;
              setStreamText(text);
            }
            if (d.reasoning) {
              reasoning += d.reasoning;
              setStreamReasoning(reasoning);
            }
          },
        );
        try {
          return parse(raw);
        } catch (e) {
          setError(
            new AiError(
              "parse",
              e instanceof Error ? e.message : String(e),
              raw,
            ),
          );
          return null;
        }
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError("http", String(e));
        if (err.kind !== "abort") setError(err);
        return null;
      } finally {
        if (ctlRef.current === ctl) {
          ctlRef.current = null;
          setLoading(false);
          setStreamText("");
          setStreamReasoning("");
        }
      }
    },
    [],
  );

  return {
    ready,
    loading,
    error,
    streamText,
    streamReasoning,
    cancel,
    run,
    runStream,
  };
}
