"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@rfjs/web-ui/components/button";
import { Textarea } from "@rfjs/web-ui/components/textarea";
import type { FieldSchema } from "@rfjs/filter-builder";

import { useAiAssist } from "@/lib/ai/use-ai-assist";
import { createAiLog, type AiAssistEntry } from "@/lib/ai/log";
import { buildNlFilterPrompt, parseNlFilterResponse } from "./ai-nl-filter";
import {
  buildAskPrompt,
  buildExplainPrompt,
  type ExplainContext,
} from "./ai-explain";

const KIND_ICON = {
  generate: Zap,
  ask: HelpCircle,
  explain: FileText,
} as const;

/** 收合狀態的全站偏好 key(不分工具 —— 不用 AI 的人收一次全部生效)。 */
export const AI_BLOCK_OPEN_KEY = "rfjs.ai.block.open";

/** 簡單葉數:遞迴數 filters 內非 group 的條件(顯示「已套用(N 個條件)」用)。 */
function countConditions(json: string): number {
  try {
    const walk = (g: unknown): number => {
      if (
        typeof g !== "object" ||
        g === null ||
        !Array.isArray((g as { filters?: unknown[] }).filters)
      )
        return 0;
      return (g as { filters: unknown[] }).filters.reduce<number>(
        (n, f) =>
          n +
          (typeof f === "object" && f !== null && "filters" in f ? walk(f) : 1),
        0,
      );
    };
    return walk(JSON.parse(json));
  } catch {
    return 0;
  }
}

export function AiAssistBlock({
  schema,
  canonicalJson,
  compiled,
  engineId,
  onApply,
  logKey,
  sampleRows,
}: {
  schema: FieldSchema[];
  canonicalJson: string;
  compiled: string | null;
  engineId: string;
  onApply: (canonicalJson: string) => void;
  logKey: string;
  /** 工具頁目前的樣本資料;prompt 只帶前 AI_SAMPLE_LIMIT 筆(見 ai-explain.ts)。 */
  sampleRows?: unknown[];
}) {
  const t = useTranslations("ToolUI");
  const locale = useLocale();
  const ai = useAiAssist();
  const [nl, setNl] = React.useState("");
  const log = React.useMemo(() => createAiLog(logKey), [logKey]);
  const [entries, setEntries] = React.useState<AiAssistEntry[]>([]);
  const [open, setOpen] = React.useState(true);

  // 掛載時還原(避免 SSR/hydration 差異,localStorage 只在 client 讀)。
  React.useEffect(() => {
    setEntries(log.list());
    setOpen(window.localStorage.getItem(AI_BLOCK_OPEN_KEY) !== "0");
  }, [log]);

  const onToggle = () => {
    setOpen((prev) => {
      window.localStorage.setItem(AI_BLOCK_OPEN_KEY, prev ? "0" : "1");
      return !prev;
    });
  };

  const ctx: ExplainContext = {
    canonicalJson,
    schema,
    compiled,
    engineId,
    locale,
    sampleRows,
  };

  const push = (partial: Omit<AiAssistEntry, "id" | "at">) => {
    const entry: AiAssistEntry = {
      ...partial,
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
    };
    setEntries(log.append(entry));
  };

  const onGenerate = async () => {
    if (!nl.trim()) return;
    const prompt = buildNlFilterPrompt(nl, schema, canonicalJson, sampleRows);
    const out = await ai.run({ ...prompt, json: true }, parseNlFilterResponse);
    if (out !== null) {
      onApply(out);
      push({ kind: "generate", prompt: nl, appliedJson: out });
      setNl("");
    }
  };

  const onAsk = async () => {
    if (!nl.trim()) return;
    const out = await ai.run(buildAskPrompt(ctx, nl), (raw) => raw.trim());
    if (out !== null) {
      push({ kind: "ask", prompt: nl, answer: out });
      setNl("");
    }
  };

  const onExplain = async () => {
    const out = await ai.run(buildExplainPrompt(ctx), (raw) => raw.trim());
    if (out !== null) push({ kind: "explain", answer: out });
  };

  const onClear = () => {
    log.clear();
    setEntries([]);
  };

  const busyOrOff = !ai.ready || ai.loading;
  const kindLabel = {
    generate: t("aiKindGenerate"),
    ask: t("aiKindAsk"),
    explain: t("aiKindExplain"),
  } as const;

  return (
    <div className="flex flex-col rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <Sparkles className="size-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-wide">
          {t("aiBlockTitle")}
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-2 px-3 pb-3">
          <div className="flex flex-wrap items-start gap-2">
            <Textarea
              rows={1}
              value={nl}
              placeholder={t("aiBlockPlaceholder")}
              disabled={!ai.ready}
              onChange={(e) => setNl(e.target.value)}
              onKeyDown={(e) => {
                // Enter 送出、Shift+Enter 換行;IME 組字確認的 Enter(isComposing)不觸發;請求進行中不重送。
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  !ai.loading
                ) {
                  e.preventDefault();
                  void onGenerate();
                }
              }}
              className="max-h-28 min-h-9 min-w-48 flex-1 resize-none py-1.5"
            />
            <Button
              size="sm"
              onClick={() => void onGenerate()}
              disabled={busyOrOff || !nl.trim()}
            >
              {t("aiGenerate")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onAsk()}
              disabled={busyOrOff || !nl.trim()}
            >
              {t("aiAsk")}
            </Button>
            <span className="h-5 w-px bg-border" aria-hidden />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onExplain()}
              disabled={busyOrOff}
            >
              {t("aiExplain")}
            </Button>
            {ai.loading ? (
              <Button size="sm" variant="outline" onClick={ai.cancel}>
                {t("aiCancel")}
              </Button>
            ) : null}
          </div>

          {!ai.ready ? (
            <p className="text-xs text-muted-foreground">
              {t("aiNotConfigured")}
            </p>
          ) : null}

          {ai.error ? (
            <div role="alert" className="text-xs text-fault">
              <p>
                [{ai.error.kind}] {ai.error.message}
              </p>
              {ai.error.kind === "parse" && ai.error.detail ? (
                <details>
                  <summary>{t("aiViewRaw")}</summary>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                    {ai.error.detail}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}

          {entries.length > 0 ? (
            <div className="rounded-md border bg-card">
              <div className="flex items-baseline justify-between gap-3 border-b px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t("aiAnswers")}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {t("aiAdvisory")}
                  <Button size="xs" variant="ghost" onClick={onClear}>
                    {t("aiClear")}
                  </Button>
                </span>
              </div>
              <ul className="flex max-h-64 flex-col overflow-y-auto">
                {[...entries].reverse().map((e) => {
                  const Icon = KIND_ICON[e.kind];
                  return (
                    <li
                      key={e.id}
                      className="flex gap-2.5 border-b px-3 py-2 text-sm last:border-b-0"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          <span className="mr-1.5 rounded border bg-muted/40 px-1 py-px font-mono text-[10px]">
                            {kindLabel[e.kind]}
                          </span>
                          {e.prompt}
                        </span>
                        {e.kind === "generate" ? (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            {t("aiApplied", {
                              count: countConditions(e.appliedJson ?? ""),
                            })}
                          </span>
                        ) : (
                          <span className="whitespace-pre-wrap">
                            {e.answer}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
