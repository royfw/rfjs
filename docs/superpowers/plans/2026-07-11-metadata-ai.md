# Metadata Builder AI 助理實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** metadata-builder 補上 AI 區塊 —— NL→`DataResourceMeta` generate(`parseDataResourceMeta` 驗證閘,套用同 import 語義)+ ask,經 #244 抽出的 `@rfjs/ai-assist-ui` 佈線。

**Architecture:** 純工具層兩檔:`ai-nl-meta.ts`(prompt builders + 驗證閘,鏡射 ai-nl-form/ai-nl-table)+ `ui.tsx` 佈線(AiPanel 置頂,generate 走既有 `handleImportMeta` 路徑)。引擎與 ai-assist 套件零改動。

**Tech Stack:** TypeScript、React 19 + next-intl、`@rfjs/ai-assist-ui`、Vitest + @testing-library/react。

## Global Constraints

- 規格:`docs/superpowers/specs/2026-07-11-metadata-ai-design.md`
- 工作目錄:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-metadata-ai` — 所有指令在此執行
- 紅線:引擎套件(`data-schema` 等)、`packages/ai-assist(-ui)`、其他工具目錄(`table-builder/**`、`app/api/**` 屬平行 #14)零改動
- 佈線照 #244 後家族現行模式(以 form-builder 為準):`import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui"`、`useAiPanelLabels` from `@/components/shared/ai-panel-labels`、`labels={aiLabels}` prop
- i18n en/zh-TW 同步(ui.spec 的 parity 測試會抓);`mbAiApplied` 用 `t("mbAiApplied", { count })` 帶值
- lint `--max-warnings 0`;零 changeset;既有測試不得刪弱
- Commit:conventional、小寫 ≤90、trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;pre-commit 失敗先讀輸出修好,不可 --no-verify
- 環境噪音:`@rfjs/db` lint 與 `@rfjs/form-builder` typecheck 在 main 上就壞,忽略

---

### Task 1: `ai-nl-meta.ts` —— prompt builders + 驗證閘

**Files:**
- Create: `apps/web/src/tools/metadata-builder/ai-nl-meta.ts`
- Test: `apps/web/src/tools/metadata-builder/ai-nl-meta.spec.ts`

**Interfaces:**
- Consumes: `parseDataResourceMeta`、`DataResourceMeta`(`@rfjs/data-schema`)
- Produces(Task 2 佈線用):
  - `buildNlMetaPrompt(nl: string, meta: DataResourceMeta): { system: string; user: string }`
  - `buildMetaAskPrompt(ctx: { metaJson: string; locale: string }, question: string): { system: string; user: string }`
  - `parseNlMetaResponse(raw: string): string`(驗證閘,失敗 throw;回傳 zod 正規化 JSON 字串)

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/metadata-builder/ai-nl-meta.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { DataResourceMeta } from "@rfjs/data-schema";

import { buildMetaAskPrompt, buildNlMetaPrompt, parseNlMetaResponse } from "./ai-nl-meta";

const META: DataResourceMeta = {
  fields: [{ key: "price", label: "Price", dataType: "numeric", filterable: true, kind: "column" }],
};
const VALID_JSON = JSON.stringify(META);

describe("buildNlMetaPrompt", () => {
  it("embeds the current meta, the kind semantics, and full-document instruction; user is the raw nl", () => {
    const p = buildNlMetaPrompt("add an order id field", META);
    expect(p.system).toContain('"price"'); // current meta embedded
    expect(p.system).toContain("column"); // kind semantics explained
    expect(p.system).toContain("jsonb");
    expect(p.system).toContain("FULL"); // full-document (not patch) instruction
    expect(p.user).toBe("add an order id field");
  });
});

describe("buildMetaAskPrompt", () => {
  it("embeds meta json and locale in system; user is the question", () => {
    const p = buildMetaAskPrompt({ metaJson: VALID_JSON, locale: "zh-TW" }, "這個資源有哪些欄位?");
    expect(p.system).toContain(VALID_JSON);
    expect(p.system).toContain("zh-TW");
    expect(p.user).toBe("這個資源有哪些欄位?");
  });
});

describe("parseNlMetaResponse", () => {
  it("accepts a valid meta and returns normalized json", () => {
    const out = parseNlMetaResponse(VALID_JSON);
    expect(JSON.parse(out)).toEqual(META);
  });

  it("strips a markdown code fence before parsing", () => {
    const out = parseNlMetaResponse("```json\n" + VALID_JSON + "\n```");
    expect(JSON.parse(out)).toEqual(META);
  });

  it("throws on malformed json", () => {
    expect(() => parseNlMetaResponse("not json {")).toThrow();
  });

  it("throws on schema-invalid meta (format incompatible with dataType)", () => {
    const bad = JSON.stringify({ fields: [{ key: "a", label: "A", dataType: "string", format: "currency" }] });
    expect(() => parseNlMetaResponse(bad)).toThrow();
  });

  it("accepts an optional request/response protocol", () => {
    const withProto = JSON.stringify({
      fields: [{ key: "a", label: "A", dataType: "string" }],
      request: { endpoint: "/api/x", pagination: { strategy: "offset", limitParam: "limit", offsetParam: "offset" } },
      response: { rowsPath: "data.items" },
    });
    expect(JSON.parse(parseNlMetaResponse(withProto)).request.endpoint).toBe("/api/x");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ai-nl-meta.spec.ts`
Expected: FAIL —— `Cannot find module './ai-nl-meta'`(全紅)

- [ ] **Step 3: 實作**

`apps/web/src/tools/metadata-builder/ai-nl-meta.ts`:

```ts
import { parseDataResourceMeta } from "@rfjs/data-schema";
import type { DataResourceMeta } from "@rfjs/data-schema";

/**
 * NL→DataResourceMeta(design spec §2)。generate 附上目前 meta:「調整」型請求基於現況、
 * 「新資源」型請求整份重來 —— 由使用者的自然語言決定;回傳一律是完整文件(不是 patch),
 * 交給 parseDataResourceMeta 驗證閘。
 */
export function buildNlMetaPrompt(nl: string, meta: DataResourceMeta): { system: string; user: string } {
  const system = [
    "You author a data resource metadata document (DataResourceMeta) as JSON ONLY, shape:",
    '{"fields":[{"key":"<dot.path>","label":"<string or {en, zh-TW}>","dataType":"string|numeric|date|boolean",',
    '"format":"integer|decimal|percent|currency|date|datetime|time"?,"options":[{"value":...,"label":...}]?,',
    '"sortable":bool?,"filterable":bool?,"kind":"column"|"jsonb"?}],',
    '"request":{"endpoint":"...","method":"GET"|"POST"?,"pagination":{...offset|page|cursor strategies...},',
    '"sort":{...}?,"filter":{"style":"pg","param":"..."}?}?,"response":{"rowsPath":"...","totalPath":"..."?,"cursorPath":"..."?}?}',
    "format compatibility: integer/decimal/percent/currency require dataType numeric; date/datetime/time require dataType date.",
    "kind semantics: how the backend queries the field — flat top-level columns lean 'column', nested dot-paths lean 'jsonb';",
    "follow the user's description when it says where a field lives. Omit kind when unsure.",
    "request/response are optional — omit anything the user did not describe. Bilingual labels ({en, zh-TW}) are welcome.",
    "Current document:",
    JSON.stringify(meta, null, 2),
    "Apply the user's request: either adjust the current document or author a new resource from scratch, as the request implies.",
    "Return the FULL resulting DataResourceMeta JSON (never a patch). Output the JSON object only.",
  ].join("\n");
  return { system, user: nl };
}

/** 詢問目前宣告(鏡射 ai-explain-form 的形狀)。 */
export function buildMetaAskPrompt(
  ctx: { metaJson: string; locale: string },
  question: string,
): { system: string; user: string } {
  const system = [
    "You are an assistant for a data-resource metadata designer (DataResourceMeta JSON: fields with kinds/formats/enums plus a request/response protocol).",
    "Current document (JSON):",
    ctx.metaJson,
    `Answer in the "${ctx.locale}" language, in plain text (no Markdown), concisely.`,
  ].join("\n");
  return { system, user: question };
}

/** 驗證閘:strip code fence → JSON.parse → parseDataResourceMeta(zod,失敗 throw)→ 正規化 JSON。 */
export function parseNlMetaResponse(raw: string): string {
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
  const meta = parseDataResourceMeta(JSON.parse(text));
  return JSON.stringify(meta, null, 2);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ai-nl-meta.spec.ts`
Expected: PASS(7 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/metadata-builder/ai-nl-meta.ts apps/web/src/tools/metadata-builder/ai-nl-meta.spec.ts
git commit -m "feat(web): nl-to-meta prompt builders and validation gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `ui.tsx` 佈線 AiPanel + messages + ui.spec

**Files:**
- Modify: `apps/web/src/tools/metadata-builder/ui.tsx`(AiPanel 置頂 + handlers)
- Modify: `apps/web/src/tools/metadata-builder/messages.ts`(en/zh-TW 各 3 鍵)
- Modify: `apps/web/src/tools/metadata-builder/ui.spec.tsx`(renderTool 換 assembleMessages + partial mock + 新 2 條)

**Interfaces:**
- Consumes: Task 1 三函式;`AiPanel, useAiAssist` from `@rfjs/ai-assist-ui`;`useAiPanelLabels` from `@/components/shared/ai-panel-labels`;既有 `handleImportMeta`(整份取代 + 重建 rows + 清選取 + 跳 Fields)
- Produces: 完整頁面(AiPanel 在 eyebrow 之下、Editor 區塊卡之上)

- [ ] **Step 1: messages 增鍵**

`messages.ts` en `ToolUI`(`mbViewingField` 之後)加:

```ts
      mbAiPlaceholder: "Describe a resource or ask a question…",
      mbAiGenerate: "Generate meta",
      mbAiApplied: "Applied ({count} fields)",
```

zh-TW 對應:

```ts
      mbAiPlaceholder: "描述資源或提出問題…",
      mbAiGenerate: "產生宣告",
      mbAiApplied: "已套用({count} 個欄位)",
```

- [ ] **Step 2: 寫失敗測試(ui.spec.tsx)**

(a) 檔頭:在既有 import 之後、`import { MetadataBuilderTool } from "./ui";` 之前加 partial mock(模式照 `form-builder/ui.spec.tsx:28-46`;`messages` import **保留** —— parity 測試還在用):

```tsx
const mockRun = vi.fn();
const mockCancel = vi.fn();

vi.mock("@rfjs/ai-assist-ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rfjs/ai-assist-ui")>()),
  useAiAssist: () => ({
    ready: true,
    loading: false,
    error: null,
    cancel: mockCancel,
    run: mockRun,
    runStream: mockRun,
    streamText: "",
    streamReasoning: "",
  }),
}));
```

(`vi` 已在既有 import;若無則補進 vitest import 清單。)

(b) `renderTool` 的 provider messages 換成完整組合(AiPanel 用共用鍵):

```tsx
import { assembleMessages } from "@/i18n/messages";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={assembleMessages("en")}>
      <MetadataBuilderTool />
    </NextIntlClientProvider>,
  );
}
```

(c) `beforeEach` 補 `mockRun.mockReset();`(既有 `localStorage.clear()` 保留)。

(d) 檔尾新增 describe:

```tsx
describe("MetadataBuilderTool AI panel", () => {
  it("generate applies the returned meta through the import path and lands on Fields", async () => {
    const generated = { fields: [{ key: "order", label: "Order", dataType: "string" }] };
    mockRun.mockResolvedValue(JSON.stringify(generated, null, 2));
    renderTool();

    // 先切去 Protocol,證明 generate 會帶回 Fields 頁籤(import 語義)
    fireEvent.click(screen.getByRole("button", { name: "Protocol" }));

    fireEvent.change(screen.getByPlaceholderText("Describe a resource or ask a question…"), {
      target: { value: "an order resource" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate meta" }));

    // 整份取代:新欄位出現在清單、舊 request 不在預覽 JSON、回到 Fields 頁籤
    expect(await screen.findByRole("option", { name: /order/ })).toBeTruthy();
    expect(screen.getByTestId("meta-json").textContent).not.toContain('"request"');
    await screen.findByText("Applied (1 fields)");
  });

  it("ask records a plain answer entry", async () => {
    mockRun.mockResolvedValue("It declares a single product resource.");
    renderTool();

    fireEvent.change(screen.getByPlaceholderText("Describe a resource or ask a question…"), {
      target: { value: "what is this?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));

    await screen.findByText("It declares a single product resource.");
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ui.spec.tsx`
Expected: 新 2 條 FAIL(placeholder/按鈕不存在);既有全 PASS(assembleMessages 是超集,parity 測試仍讀 fragment 的 `messages`)

- [ ] **Step 4: 實作佈線(ui.tsx)**

(a) import 補:

```tsx
import { useLocale } from "next-intl";
import { AiPanel, useAiAssist } from "@rfjs/ai-assist-ui";

import { useAiPanelLabels } from "@/components/shared/ai-panel-labels";
import { buildMetaAskPrompt, buildNlMetaPrompt, parseNlMetaResponse } from "./ai-nl-meta";
```

(既有 `import { useTranslations } from "next-intl";` 改成 `import { useLocale, useTranslations } from "next-intl";`,不另開重複行。)

(b) component 頂部(`const t = …` 之後):

```tsx
  const locale = useLocale();
  const ai = useAiAssist();
  const aiLabels = useAiPanelLabels();
```

(c) handlers 區加(reapply 與 generate 共用;舊紀錄再過一次 zod,壞紀錄靜默略過 —— 比照 table-builder 模式):

```tsx
  function applyGeneratedMeta(json: string) {
    try {
      handleImportMeta(parseDataResourceMeta(JSON.parse(json)));
    } catch {
      // stale/foreign log entry — leave the current meta untouched
    }
  }
```

(d) JSX:eyebrow `<p>` 之後、Editor 區塊卡之前插入:

```tsx
      <AiPanel
        title={t("aiBlockTitle")}
        placeholder={t("mbAiPlaceholder")}
        logKey="rfjs.ai.log.metadata-builder"
        ai={ai}
        labels={aiLabels}
        onReapply={(e) => applyGeneratedMeta(e.appliedJson ?? "")}
        appliedSummary={(e) => {
          let n = 0;
          try {
            const parsed = JSON.parse(e.appliedJson ?? "") as { fields?: unknown[] };
            n = Array.isArray(parsed.fields) ? parsed.fields.length : 0;
          } catch {
            n = 0;
          }
          return t("mbAiApplied", { count: n });
        }}
        actions={[
          {
            key: "generate",
            label: t("mbAiGenerate"),
            needsInput: true,
            primary: true,
            run: async (input) => {
              const out = await ai.run({ ...buildNlMetaPrompt(input, meta), json: true }, parseNlMetaResponse);
              if (out === null) return null;
              applyGeneratedMeta(out);
              return { kind: "generate", prompt: input, appliedJson: out };
            },
          },
          {
            key: "ask",
            label: t("aiAsk"),
            needsInput: true,
            run: async (input) => {
              const out = await ai.runStream(
                buildMetaAskPrompt({ metaJson: JSON.stringify(meta, null, 2), locale }, input),
                (raw) => raw.trim(),
              );
              return out === null ? null : { kind: "ask", prompt: input, answer: out };
            },
          },
        ]}
      />
```

- [ ] **Step 5: 跑測試 + lint + typecheck**

Run: `pnpm -F web exec vitest run src/tools/metadata-builder/ src/i18n/ && pnpm -F web lint && pnpm -F web check-types`
Expected: 全 PASS(ui.spec 12 條:parity 1 + 既有 9 + 新 2;ai-nl-meta 7);lint/typecheck 綠

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/metadata-builder/ui.tsx apps/web/src/tools/metadata-builder/ui.spec.tsx apps/web/src/tools/metadata-builder/messages.ts
git commit -m "feat(web): wire ai panel into metadata-builder for generate and ask

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 全量驗證 + 截圖 + HOLD PR

**Files:** 無新程式;截圖(scratchpad)與 PR

- [ ] **Step 1: 全量檢查 + build + e2e 回歸**

Run: `pnpm build:packages && pnpm test && pnpm -F web build`
Expected: 全綠

Run(截圖/e2e 前先清 3013 殘留 server —— 按 port 找 pid 精準殺,不用 pkill 模糊匹配):
`ss -ltnp | grep 3013 | grep -oP 'pid=\K[0-9]+' | xargs -r kill -9`
`E2E_PORT=3013 pnpm -F web test:e2e e2e/metadata-builder.e2e.ts`
Expected: 既有 2 條 PASS(本輪未動 e2e;AiPanel 增加不影響既有 selector —— hydration gate 用 Protocol/switch,不受影響)

- [ ] **Step 2: 截圖(light + dark)**

production build 起服(3013),拍:整頁含 AI 區塊(未設連線 → 降級提示態)。light/dark 各一張,人工檢視(AiPanel 置頂、Editor 卡與 code panel 卡不受影響)。截圖存 scratchpad,回報附絕對路徑。

- [ ] **Step 3: push + HOLD PR**

```bash
git push -u origin feat-metadata-ai
gh pr create --title "feat: ai assist for the metadata builder (nl-to-meta and ask)" --body "$(cat <<'EOF'
## Summary
- the metadata-builder gains the family-standard AI block: generate (NL → full `DataResourceMeta` — fields with kind guesses, enum domains, optional protocol — gated by `parseDataResourceMeta`, applied through the same path as meta.json import) and ask (Q&A over the current declaration)
- the third authoring on-ramp alongside manual declaration and sample-rows inference
- first new consumer of the extracted `@rfjs/ai-assist(-ui)` packages (#244): `AiPanel`/`useAiAssist` from the package, labels via the shared `useAiPanelLabels`
- zero changesets (apps/web only); engines and the ai-assist packages untouched

**HOLD: do not merge** — pending user review.

Spec: docs/superpowers/specs/2026-07-11-metadata-ai-design.md
Plan: docs/superpowers/plans/2026-07-11-metadata-ai.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR 建立,回報 PR 連結 + 截圖絕對路徑,等使用者 review/merge。
