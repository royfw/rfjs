# @rfjs/ai-assist-ui

> 繁體中文 → [README.zh-TW.md](./README.zh-TW.md)

Thin **React** layer over [@rfjs/ai-assist](../ai-assist): a `useAiAssist()`
hook (run/runStream against the configured BYOK connection, with loading /
error / streaming state) and an `<AiPanel>` shell (collapsible block, prompt
box, action buttons, streaming preview, and an interaction log with
reapply). It **holds only UI + request state** — settings storage, the
`complete`/`stream` client, auth strategies, and the interaction-log store
all live in `ai-assist`.

> **Private / internal.** Not published to npm. Consumed inside the monorepo
> via Next.js `transpilePackages` (used from `src`, no build step). Peer
> deps: `react`, `react-dom`.

---

## Usage

```tsx
"use client";
import { useAiAssist, AiPanel, type AiPanelAction } from "@rfjs/ai-assist-ui";

export function MyToolAiBlock({ config, applyConfig }: MyToolProps) {
  const ai = useAiAssist();

  const actions: AiPanelAction[] = [
    {
      key: "generate",
      label: "Generate",
      needsInput: true,
      primary: true,
      run: async (input) => {
        const out = await ai.run(
          { system: "...", user: buildPrompt(input, config), json: true },
          parseGeneratedConfig,
        );
        if (out === null) return null; // ai.error is already set
        applyConfig(out);
        return {
          kind: "generate",
          prompt: input,
          appliedJson: JSON.stringify(out),
        };
      },
    },
    {
      key: "ask",
      label: "Ask",
      needsInput: true,
      run: async (input) => {
        const out = await ai.runStream(
          { system: "...", user: buildAskPrompt(input, config) },
          (raw) => raw.trim(),
        );
        return out === null
          ? null
          : { kind: "ask", prompt: input, answer: out };
      },
    },
  ];

  return (
    <AiPanel
      title="AI Assist"
      placeholder="Describe what you want…"
      logKey="rfjs.ai.log.my-tool"
      ai={ai}
      actions={actions}
      onReapply={(entry) =>
        applyConfig(JSON.parse(entry.appliedJson ?? "null"))
      }
      appliedSummary={(entry) => `applied (${entry.at})`}
      labels={{
        kindGenerate: "generate",
        kindAsk: "ask",
        kindExplain: "explain",
        kindCheck: "check",
        cancel: "Cancel",
        notConfigured:
          "AI is not configured yet — open Settings to add a connection.",
        viewRaw: "View raw response",
        thinking: "Thinking…",
        answers: "AI answers",
        advisory: "Advisory only",
        clear: "Clear",
        reapply: "Reapply",
      }}
    />
  );
}
```

`useAiAssist()` reads the BYOK connection via `@rfjs/ai-assist`'s
`loadAiSettings()`/`subscribeAiSettings()`, so `ready` flips to `true` the
moment a user saves settings in the same tab — no reload needed. `run()` is a
single-shot request (used with `json: true` for structured "generate"
actions); `runStream()` is the SSE variant — it updates `ai.streamText` /
`ai.streamReasoning` as chunks arrive and only calls `parse()` once the full
text is in. Both cancel any in-flight request from the same hook instance
before starting a new one, and ignore `AiError` of kind `'abort'` (the user
cancelling is not an error).

## `useAiAssist()` return shape (`UseAiAssist`)

| field                   | type                                                        | purpose                                                                                         |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ready`                 | `boolean`                                                   | `true` once a BYOK connection is configured (SSR-safe: `false` on the server)                   |
| `loading`               | `boolean`                                                   | a `run`/`runStream` call is in flight                                                           |
| `error`                 | `AiError \| null`                                           | last error (`kind`: `'config'` `'http'` `'timeout'` `'abort'` `'parse'`)                        |
| `streamText`            | `string`                                                    | text accumulated so far during `runStream` (empty outside streaming)                            |
| `streamReasoning`       | `string`                                                    | reasoning/thinking text accumulated so far, when the gateway passes through `reasoning_content` |
| `cancel()`              | `() => void`                                                | abort the in-flight request                                                                     |
| `run(req, parse)`       | `<T>(req, parse: (raw: string) => T) => Promise<T \| null>` | single-shot completion, then `parse()` the raw text; `null` on error/cancel (check `error`)     |
| `runStream(req, parse)` | same signature                                              | SSE variant; updates `streamText`/`streamReasoning` while streaming, `parse()`s once complete   |

`req` is `CompleteRequest` from `@rfjs/ai-assist` minus `signal` (the hook
supplies its own `AbortController`).

## `<AiPanel>` props

| prop              | type                               | purpose                                                                                                                      |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `title`           | `string`                           | header label next to the collapse chevron                                                                                    |
| `placeholder`     | `string`                           | prompt textarea placeholder                                                                                                  |
| `actions`         | `AiPanelAction[]`                  | buttons rendered in prompt-row order; a divider is inserted between the last `needsInput` action and the first that isn't    |
| `logKey`          | `string`                           | storage key for this panel's interaction log (`createAiLog(logKey)`) — scope it per tool, e.g. `"rfjs.ai.log.table-builder"` |
| `ai`              | `ReturnType<typeof useAiAssist>`   | the hook instance driving this panel                                                                                         |
| `onReapply?`      | `(entry: AiAssistEntry) => void`   | shown as a "Reapply" button on log entries that have `appliedJson`                                                           |
| `appliedSummary?` | `(entry: AiAssistEntry) => string` | text shown in place of the raw answer for entries with `appliedJson`                                                         |
| `labels`          | `AiPanelLabels`                    | all UI strings (labels-as-props; see below)                                                                                  |

The panel is otherwise self-contained: it holds its own prompt-box text,
collapsed/open state (persisted per-browser under `AI_BLOCK_OPEN_KEY`,
restored after mount to stay SSR/hydration-safe), and the interaction log
list (loaded from `createAiLog(logKey)` on mount, appended to on each
successful action). Pressing **Enter** in the textarea (no Shift, not
mid-IME-composition) runs the first action with `needsInput: true`.

### `AiPanelAction`

```ts
interface AiPanelAction {
  key: string;
  label: string;
  needsInput?: boolean; // disabled until the textarea has text; wired to Enter-to-run
  primary?: boolean; // rendered with the "default" (filled) button variant
  run: (input: string) => Promise<Omit<AiAssistEntry, "id" | "at"> | null>;
}
```

Return `null` from `run` when the request failed or was cancelled — the
panel already reads `ai.error`, so don't duplicate error UI in `run` itself.
Return a partial `AiAssistEntry` (no `id`/`at` — the panel stamps those) to
append a log entry; include `appliedJson` when the action already applied a
result to the caller's own state (drives `appliedSummary`/`onReapply`), or
`answer` for a display-only response (e.g. `ask`/`explain`).

### `AiPanelLabels`

```ts
interface AiPanelLabels {
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
```

Every string the panel renders is a required prop — there is no built-in
i18n framework coupling (no `next-intl`/`react-intl` dependency). Callers
pass whatever their own translation function produces, so the panel works
the same under next-intl, a plain dictionary, or a hardcoded string map in
tests.

## Other exports

- **`AI_BLOCK_OPEN_KEY`** — the `localStorage` key the panel uses to persist
  its collapsed/open state across visits (`"rfjs.ai.block.open"`).

## Related

- **[@rfjs/ai-assist](../ai-assist)** — the framework-free client, settings
  storage, auth strategies, and interaction-log store this panel renders.
- **[@rfjs/web-ui](../web-ui)** — design tokens & components (`Button`,
  `Textarea`) used for styling.
