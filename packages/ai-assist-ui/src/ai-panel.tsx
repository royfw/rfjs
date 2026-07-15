"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Sparkles,
  Zap,
} from "lucide-react";

import { Button } from "@rfjs/web-ui/components/button";
import { Textarea } from "@rfjs/web-ui/components/textarea";

import { createAiLog, type AiAssistEntry } from "@rfjs/ai-assist";
import { useAiAssist } from "./use-ai-assist";

export const AI_BLOCK_OPEN_KEY = "rfjs.ai.block.open";

const KIND_ICON = {
  generate: Zap,
  ask: HelpCircle,
  explain: FileText,
  check: ClipboardCheck,
} as const;

export interface AiPanelAction {
  key: string;
  label: string;
  needsInput?: boolean;
  primary?: boolean;
  run: (input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>;
}

export interface AiPanelLabels {
  kindGenerate: string;
  kindAsk: string;
  kindExplain: string;
  kindCheck: string;
  cancel: string;
  notConfigured: string;
  viewRaw: string;
  thinking: string;
  answers: string;
  advisory: string;
  clear: string;
  reapply: string;
}

export function AiPanel({
  title,
  placeholder,
  actions,
  logKey,
  ai,
  onReapply,
  appliedSummary,
  labels,
}: {
  title: string;
  placeholder: string;
  actions: AiPanelAction[];
  logKey: string;
  ai: ReturnType<typeof useAiAssist>;
  onReapply?: (entry: AiAssistEntry) => void;
  appliedSummary?: (entry: AiAssistEntry) => string;
  labels: AiPanelLabels;
}) {
  const [nl, setNl] = React.useState("");
  const log = React.useMemo(() => createAiLog(logKey), [logKey]);
  const [entries, setEntries] = React.useState<AiAssistEntry[]>([]);
  const [open, setOpen] = React.useState(true);

  // 掛載時還原(SSR/hydration 安全:localStorage 只在 client 讀)。
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

  const exec = async (action: AiPanelAction) => {
    if (action.needsInput && !nl.trim()) return;
    const partial = await action.run(nl);
    if (partial !== null) {
      const entry: AiAssistEntry = {
        ...partial,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      };
      setEntries(log.append(entry));
      if (action.needsInput) setNl("");
    }
  };

  const enterAction = actions.find((a) => a.needsInput);
  const busyOrOff = !ai.ready || ai.loading;
  const kindLabel: Record<string, string> = {
    generate: labels.kindGenerate,
    ask: labels.kindAsk,
    explain: labels.kindExplain,
    check: labels.kindCheck,
  };

  const renderAction = (a: AiPanelAction) => (
    <Button
      size="sm"
      variant={a.primary ? "default" : "outline"}
      onClick={() => void exec(a)}
      disabled={busyOrOff || (a.needsInput ? !nl.trim() : false)}
    >
      {a.label}
    </Button>
  );

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border bg-card">
      {/* Header matches the studio SectionCard slab (bg-muted/30 · px-4 py-2.5 · border-b when
          open). The collapse chevron is kept in its own segment, gap-3 from the AI identity
          cluster (sparkle + title), so the arrow no longer reads as cramped against the icon. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-3 bg-muted/30 px-4 py-2.5 text-left text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50${
          open ? " border-b" : ""
        }`}
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0" />
        ) : (
          <ChevronRight className="size-4 shrink-0" />
        )}
        <span className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <span className="font-mono text-xs uppercase tracking-wide">
            {title}
          </span>
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-start gap-2">
            <Textarea
              rows={1}
              value={nl}
              placeholder={placeholder}
              disabled={!ai.ready}
              onChange={(e) => setNl(e.target.value)}
              onKeyDown={(e) => {
                // Enter=第一個 needsInput 動作;Shift+Enter 換行;IME/loading 防護。
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing &&
                  !ai.loading &&
                  enterAction
                ) {
                  e.preventDefault();
                  void exec(enterAction);
                }
              }}
              className="max-h-28 min-h-9 min-w-48 flex-1 resize-none py-1.5"
            />
            {/* 依陣列順序渲染(順序=mockup 順序);分隔線插在「需輸入 → 免輸入」的交界。 */}
            {actions.map((a, i) => (
              <React.Fragment key={a.key}>
                {renderAction(a)}
                {a.needsInput &&
                actions[i + 1] &&
                !actions[i + 1]!.needsInput ? (
                  <span className="h-5 w-px bg-border" aria-hidden />
                ) : null}
              </React.Fragment>
            ))}
            {ai.loading ? (
              <Button size="sm" variant="outline" onClick={ai.cancel}>
                {labels.cancel}
              </Button>
            ) : null}
          </div>

          {!ai.ready ? (
            <p className="text-xs text-muted-foreground">
              {labels.notConfigured}
            </p>
          ) : null}

          {ai.error ? (
            <div role="alert" className="text-xs text-fault">
              <p>
                [{ai.error.kind}] {ai.error.message}
              </p>
              {ai.error.kind === "parse" && ai.error.detail ? (
                <details>
                  <summary>{labels.viewRaw}</summary>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs">
                    {ai.error.detail}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}

          {ai.loading && (ai.streamText || ai.streamReasoning) ? (
            <div className="rounded-md border bg-card px-3 py-2 text-sm">
              {ai.streamReasoning ? (
                <details open className="mb-1">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    {labels.thinking}
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                    {ai.streamReasoning}
                  </pre>
                </details>
              ) : null}
              <span className="whitespace-pre-wrap">{ai.streamText}</span>
            </div>
          ) : null}

          {entries.length > 0 ? (
            <div className="rounded-md border bg-card">
              <div className="flex items-baseline justify-between gap-3 border-b px-3 py-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {labels.answers}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {labels.advisory}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      log.clear();
                      setEntries([]);
                    }}
                  >
                    {labels.clear}
                  </Button>
                </span>
              </div>
              <ul className="flex max-h-64 flex-col overflow-y-auto">
                {[...entries].reverse().map((e) => {
                  const Icon =
                    KIND_ICON[e.kind as keyof typeof KIND_ICON] ?? Sparkles;
                  return (
                    <li
                      key={e.id}
                      className="flex gap-2.5 border-b px-3 py-2 text-sm last:border-b-0"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">
                          <span className="mr-1.5 rounded border bg-muted/40 px-1 py-px font-mono text-[10px]">
                            {kindLabel[e.kind] ?? e.kind}
                          </span>
                          {e.prompt}
                        </span>
                        {e.appliedJson && appliedSummary ? (
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400">
                              {appliedSummary(e)}
                            </span>
                            {onReapply ? (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => onReapply(e)}
                              >
                                {labels.reapply}
                              </Button>
                            ) : null}
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
    </section>
  );
}
