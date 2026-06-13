# Web 快速工具 batch 1（Phase 3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/tools/[slug]` 從 coming-soon 變成真實互動工具，batch 1 做 type-converter + object-flatten 兩個：輸入即時跑 `@rfjs/*` 純函式 → 輸出，左右並排 + 中間 Seam 佈局（延續首頁 hero-specimen）。

**Architecture:** 純邏輯抽成可測函式（`lib/tools/*.ts`），React 元件是薄 view（`components/tools/*.tsx`）；佈局用 apps/web 的 `ToolShell`（並排 + Seam），共用 primitive 是 `@rfjs/web-ui` 的 `Panel`（加 optional `action` header slot 放 copy 鈕）。型別選擇器用既有的 `@rfjs/web-ui` `DropdownMenu`（延續 locale-switcher）。`/tools/[slug]` 改用 registry `surface`+`id`（退役 vestigial `href`），slug→元件對照表命中才 render 真工具、否則 coming-soon。

**Tech Stack:** Next 16 App Router / React 19 / next-intl 4 / @rfjs/data-transform / @rfjs/object-utils / @rfjs/web-ui / vitest

**Spec:** `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md` §10（Phase 3）

**範圍：** batch 1 僅 type-converter + object-flatten。其餘 4 個 web 工具（data-filter-tester、2 個 query generator）維持 coming-soon（batch 2，另一份 plan）。jwt-decoder 在 Phase 6。CodeMirror 不在本 Phase（JSON 用 textarea）。

**慣例：** commit subject 不可句首大寫（commitlint `subject-case`）——用小寫開頭。Co-Authored-By 依執行者模型名。pre-commit 跑 `turbo run lint-staged test --affected`；瞬時 pnpm "Unexpected end of JSON input" → 原樣重試一次。

---

### Task 1: Panel 加 `action` header slot（@rfjs/web-ui，TDD）

**Files:**
- Modify: `packages/web-ui/src/components/panel.tsx`
- Modify: `packages/web-ui/src/components/panel.spec.tsx`

- [ ] **Step 1: 加失敗測試** — 在 `panel.spec.tsx` 既有 describe 內追加：

```tsx
  it("renders an action in the header", () => {
    render(
      <Panel title="Output" action={<button>copy</button>}>
        body
      </Panel>,
    );
    expect(screen.getByRole("button", { name: "copy" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Output" })).toBeDefined();
  });

  it("renders the action even with no title, and still no heading", () => {
    render(<Panel action={<button>copy</button>}>body</Panel>);
    expect(screen.getByRole("button", { name: "copy" })).toBeDefined();
    expect(screen.queryByRole("heading")).toBeNull();
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/web-ui vitest:run`
Expected: FAIL（action 未渲染 → 找不到 button）

- [ ] **Step 3: 改 `panel.tsx`** — 整檔取代：

```tsx
import type { ReactNode } from "react";

import { cn } from "../lib/utils";

export interface PanelProps {
  title?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function Panel({ title, action, children, className }: PanelProps) {
  const hasHeader = Boolean(title) || Boolean(action);
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>
      {hasHeader ? (
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          {title ? (
            <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
              {title}
            </h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
```

（既有用法只傳 `title`：仍渲染 h2、視覺幾乎不變——標題改包在 flex div 內，border/padding 移到 div。`queryByRole("heading")` 在無 title 時仍為 null，既有測試不破。）

- [ ] **Step 4: 跑測試 + 確認既有 workbench 用法沒壞**

Run: `pnpm -F @rfjs/web-ui vitest:run && pnpm -F @rfjs/web-ui check-types && pnpm -F @rfjs/web-ui lint && pnpm -F workbench build`
Expected: 全綠（workbench dashboard/datasets 用 Panel 只傳 title，照常）

- [ ] **Step 5: Commit**

```bash
git add packages/web-ui/src/components/panel.tsx packages/web-ui/src/components/panel.spec.tsx
git commit -m "feat(web-ui): add optional action slot to Panel header

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 2: ToolUI messages + ToolShell 佈局（apps/web）

**Files:**
- Modify: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`
- Create: `apps/web/src/components/tools/tool-shell.tsx`

- [ ] **Step 1: 兩個 locale 加 `ToolUI` namespace（結構需完全一致）**

`en.json` 頂層加：
```json
  "ToolUI": {
    "input": "Input",
    "output": "Output",
    "inputValue": "Value",
    "targetType": "Target type",
    "jsonInput": "JSON",
    "copy": "Copy",
    "types": {
      "string": "String",
      "number": "Number",
      "integer": "Integer",
      "boolean": "Boolean",
      "date": "Date",
      "any": "Any"
    },
    "error": {
      "nan": "Not a number",
      "invalidDate": "Invalid date",
      "invalidJson": "Invalid JSON",
      "notObject": "Expected a JSON object"
    }
  }
```

`zh-TW.json` 頂層加：
```json
  "ToolUI": {
    "input": "輸入",
    "output": "輸出",
    "inputValue": "值",
    "targetType": "目標型別",
    "jsonInput": "JSON",
    "copy": "複製",
    "types": {
      "string": "字串",
      "number": "數字",
      "integer": "整數",
      "boolean": "布林",
      "date": "日期",
      "any": "任意"
    },
    "error": {
      "nan": "不是數字",
      "invalidDate": "無效日期",
      "invalidJson": "無效的 JSON",
      "notObject": "需要 JSON 物件"
    }
  }
```

- [ ] **Step 2: 建 `tool-shell.tsx`**（純佈局，鏡像 hero-specimen 的並排 + Seam 結構）

```tsx
import { Seam } from "@rfjs/web-ui/components/seam";
import type { ReactNode } from "react";

export function ToolShell({
  operation,
  input,
  output,
}: {
  operation: string;
  input: ReactNode;
  output: ReactNode;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 lg:flex-row">
      <div className="min-w-0 flex-1">{input}</div>
      <div className="flex shrink-0 items-center justify-center py-1 lg:px-1 lg:py-0">
        <Seam state="current" operation={operation} orientation="horizontal" className="lg:hidden" />
        <Seam state="current" operation={operation} orientation="vertical" className="hidden lg:flex" />
      </div>
      <div className="min-w-0 flex-1">{output}</div>
    </div>
  );
}
```

- [ ] **Step 3: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint`
（build 留待工具接上後；此步只確認 messages JSON 合法 + ToolShell typecheck）
另確認 i18n 結構一致：
```bash
node -e "const a=require('/home/royfw/_/royfw/_apps/rfjs/apps/web/src/messages/en.json'),b=require('/home/royfw/_/royfw/_apps/rfjs/apps/web/src/messages/zh-TW.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);console.log(JSON.stringify(f(a).sort())===JSON.stringify(f(b).sort())?'KEYS-MATCH':'KEYS-DIFFER')"
```
Expected: KEYS-MATCH

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json apps/web/src/components/tools/tool-shell.tsx
git commit -m "feat(web): add ToolUI messages and ToolShell layout (side-by-side + Seam)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 3: type-converter（邏輯 TDD + 元件）

**Files:**
- Create: `apps/web/src/lib/tools/type-converter.ts`
- Test: `apps/web/src/lib/tools/type-converter.spec.ts`
- Create: `apps/web/src/components/tools/type-converter.tsx`

- [ ] **Step 1: 寫失敗測試** — `type-converter.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { convertType, CONVERT_TYPES } from "./type-converter";

describe("convertType", () => {
  it("converts a numeric string to number", () => {
    expect(convertType("42", "number")).toEqual({ ok: true, output: "42", runtimeType: "number" });
  });
  it("flags a non-numeric string as nan", () => {
    expect(convertType("abc", "number")).toEqual({ ok: false, error: "nan" });
  });
  it("converts to boolean", () => {
    expect(convertType("true", "boolean")).toEqual({ ok: true, output: "true", runtimeType: "boolean" });
  });
  it("converts a valid date to ISO", () => {
    const r = convertType("2020-01-01", "date");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.runtimeType).toBe("Date");
      expect(r.output).toContain("2020-01-01");
    }
  });
  it("flags an invalid date", () => {
    expect(convertType("nope", "date")).toEqual({ ok: false, error: "invalidDate" });
  });
  it("passes a string through", () => {
    expect(convertType("hi", "string")).toEqual({ ok: true, output: "hi", runtimeType: "string" });
  });
  it("exposes the selectable types", () => {
    expect(CONVERT_TYPES).toEqual(["string", "number", "integer", "boolean", "date", "any"]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run`
Expected: FAIL — Cannot find module './type-converter'

- [ ] **Step 3: 實作 `type-converter.ts`**

```ts
import { typeTransfer, type DataType } from "@rfjs/data-transform";

// typeTransfer's date branch returns a Date; number/integer use Number() (can be NaN).
export const CONVERT_TYPES: DataType[] = ["string", "number", "integer", "boolean", "date", "any"];

export type ConvertResult =
  | { ok: true; output: string; runtimeType: string }
  | { ok: false; error: "nan" | "invalidDate" };

export function convertType(input: string, type: DataType): ConvertResult {
  const result = typeTransfer(input, type);
  if ((type === "number" || type === "integer") && Number.isNaN(result as number)) {
    return { ok: false, error: "nan" };
  }
  if (type === "date") {
    const d = result as Date;
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invalidDate" };
    return { ok: true, output: d.toISOString(), runtimeType: "Date" };
  }
  return { ok: true, output: String(result), runtimeType: typeof result };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run`
Expected: PASS（7 個 convertType 測試）

- [ ] **Step 5: 建元件 `type-converter.tsx`**（型別選擇器用 DropdownMenu，鏡像 locale-switcher）

```tsx
"use client";

import { type DataType } from "@rfjs/data-transform";
import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rfjs/web-ui/components/dropdown-menu";
import { Panel } from "@rfjs/web-ui/components/panel";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { convertType, CONVERT_TYPES } from "@/lib/tools/type-converter";

import { ToolShell } from "./tool-shell";

export function TypeConverter() {
  const t = useTranslations("ToolUI");
  const [value, setValue] = useState("42");
  const [type, setType] = useState<DataType>("number");
  const result = convertType(value, type);

  return (
    <ToolShell
      operation="typeTransfer()"
      input={
        <Panel title={t("input")}>
          <div className="flex flex-col gap-2">
            <input
              aria-label={t("inputValue")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-sm border bg-transparent px-2 py-1.5 font-mono text-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t("targetType")} className="justify-between gap-2">
                  {t(`types.${type}`)}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {CONVERT_TYPES.map((ty) => (
                  <DropdownMenuItem key={ty} onSelect={() => setType(ty)}>
                    <Check className={ty === type ? "size-4 opacity-100" : "size-4 opacity-0"} />
                    {t(`types.${ty}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Panel>
      }
      output={
        <Panel
          title={t("output")}
          action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
        >
          {result.ok ? (
            <div className="flex flex-col gap-1">
              <pre className="overflow-x-auto font-mono text-sm text-signal">{result.output}</pre>
              <span className="font-mono text-[10px] text-muted-foreground">{result.runtimeType}</span>
            </div>
          ) : (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          )}
        </Panel>
      }
    />
  );
}
```

確認 `ChevronDown`/`Check` 是 lucide-react v1.17 的有效 icon（locale-switcher 已用 Check；ChevronDown 為標準 icon）。`text-fault` 是 web-ui token（錯誤紅）；若不存在，查 globals.css 用對應 destructive token，註明。

- [ ] **Step 6: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run`
Expected: 全綠。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/tools/type-converter.ts apps/web/src/lib/tools/type-converter.spec.ts apps/web/src/components/tools/type-converter.tsx
git commit -m "feat(web): type-converter quick tool (data-transform typeTransfer)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 4: object-flatten（邏輯 TDD + 元件）

**Files:**
- Create: `apps/web/src/lib/tools/object-flatten.ts`
- Test: `apps/web/src/lib/tools/object-flatten.spec.ts`
- Create: `apps/web/src/components/tools/object-flatten.tsx`

- [ ] **Step 1: 寫失敗測試** — `object-flatten.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { flattenJson } from "./object-flatten";

describe("flattenJson", () => {
  it("flattens a nested object to dot-path keys", () => {
    const r = flattenJson('{"a":{"b":1},"c":true}');
    expect(r).toEqual({ ok: true, output: '{\n  "a.b": 1,\n  "c": true\n}' });
  });
  it("rejects invalid JSON", () => {
    expect(flattenJson("not json")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("rejects a top-level array", () => {
    expect(flattenJson("[1,2]")).toEqual({ ok: false, error: "notObject" });
  });
  it("rejects a top-level primitive", () => {
    expect(flattenJson("42")).toEqual({ ok: false, error: "notObject" });
  });
  it("rejects null", () => {
    expect(flattenJson("null")).toEqual({ ok: false, error: "notObject" });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run`
Expected: FAIL — Cannot find module './object-flatten'

- [ ] **Step 3: 實作 `object-flatten.ts`**

```ts
import { flatten } from "@rfjs/object-utils";

export type FlattenResult =
  | { ok: true; output: string }
  | { ok: false; error: "invalidJson" | "notObject" };

export function flattenJson(text: string): FlattenResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "notObject" };
  }
  return { ok: true, output: JSON.stringify(flatten(parsed as object), null, 2) };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run`
Expected: PASS

- [ ] **Step 5: 建元件 `object-flatten.tsx`**

```tsx
"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { flattenJson } from "@/lib/tools/object-flatten";

import { ToolShell } from "./tool-shell";

const SAMPLE = `{
  "user": {
    "name": "Ada",
    "roles": ["admin", "dev"]
  },
  "active": true
}`;

export function ObjectFlatten() {
  const t = useTranslations("ToolUI");
  const [text, setText] = useState(SAMPLE);
  const result = flattenJson(text);

  return (
    <ToolShell
      operation="flatten()"
      input={
        <Panel title={t("jsonInput")}>
          <textarea
            aria-label={t("jsonInput")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={10}
            className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
          />
        </Panel>
      }
      output={
        <Panel
          title={t("output")}
          action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}
        >
          {result.ok ? (
            <pre className="overflow-x-auto font-mono text-sm text-signal">{result.output}</pre>
          ) : (
            <p className="font-mono text-sm text-fault">{t(`error.${result.error}`)}</p>
          )}
        </Panel>
      }
    />
  );
}
```

- [ ] **Step 6: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run`
Expected: 全綠。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/tools/object-flatten.ts apps/web/src/lib/tools/object-flatten.spec.ts apps/web/src/components/tools/object-flatten.tsx
git commit -m "feat(web): object-flatten quick tool (object-utils flatten)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 5: tools registry + `/tools/[slug]` 改寫（退役 vestigial href）

**Files:**
- Create: `apps/web/src/components/tools/registry.tsx`
- Modify: `apps/web/src/app/[locale]/(site)/tools/[slug]/page.tsx`

- [ ] **Step 1: 建 `registry.tsx`**（slug → 真實工具元件）

```tsx
import type { ComponentType } from "react";

import { ObjectFlatten } from "./object-flatten";
import { TypeConverter } from "./type-converter";

// Web quick tools with a live implementation. Tool ids absent here render the
// "coming soon" placeholder on /tools/[slug].
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "type-converter": TypeConverter,
  "object-flatten": ObjectFlatten,
};
```

- [ ] **Step 2: 改寫 `tools/[slug]/page.tsx`**（用 surface+id，退役 href；命中 registry render 真工具，否則 coming-soon）

```tsx
import { toolRegistry } from "@rfjs/web-core";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { TOOL_COMPONENTS } from "@/components/tools/registry";

export function generateStaticParams() {
  return toolRegistry
    .filter((tool) => tool.surface === "web")
    .map((tool) => ({ slug: tool.id }));
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const tool = toolRegistry.find((t) => t.surface === "web" && t.id === slug);
  if (!tool) notFound();
  const t = await getTranslations({ locale, namespace: "Tools" });
  const tDetail = await getTranslations({ locale, namespace: "Detail" });
  const tStatus = await getTranslations({ locale, namespace: "Status" });
  const Tool = TOOL_COMPONENTS[tool.id];
  return (
    <>
      <PageHeader title={t(`${tool.id}.title`)} description={t(`${tool.id}.description`)} />
      {Tool ? (
        <Tool />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tDetail("toolComingSoon")}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {tDetail("status", { status: tStatus(tool.status) })}
          </p>
        </>
      )}
    </>
  );
}
```

（server component 渲染 client 工具元件是標準作法；registry.tsx 不需 `"use client"`——只是元件參照表。`generateStaticParams` 現產出全部 6 個 web 工具的 slug，2 個真、4 個 coming-soon。）

- [ ] **Step 3: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build`
Expected: 全綠；route table 含 `/tools/[slug]`（6 個 web slug SSG：type-converter、object-flatten、data-filter-tester、jwt-decoder、jsonb-query-generator、mongo-query-generator）。確認無殘留讀 `tool.href` 於此頁。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tools/registry.tsx "apps/web/src/app/[locale]/(site)/tools/[slug]/page.tsx"
git commit -m "feat(web): wire real tools on /tools/[slug] via surface+id registry

Retires the vestigial registry href on the web side: generateStaticParams
and lookup now key off surface==='web' + id. Tools in TOOL_COMPONENTS render
live; the rest stay coming-soon.

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 6: 全面驗證（含真實瀏覽器）+ README

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: 確認套件 client 安全**（data-transform / object-utils 無 node 依賴）

```bash
grep -rn "require(\|from ['\"]\(crypto\|fs\|path\|buffer\)" packages/data-transform/src packages/object-utils/src || echo "no node deps (client-safe)"
```
Expected: no node deps（兩者皆純 JS）

- [ ] **Step 2: 全 web 驗證 sweep**

```bash
rm -rf apps/web/.next
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build
node -e "const a=require('/home/royfw/_/royfw/_apps/rfjs/apps/web/src/messages/en.json'),b=require('/home/royfw/_/royfw/_apps/rfjs/apps/web/src/messages/zh-TW.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);console.log(JSON.stringify(f(a).sort())===JSON.stringify(f(b).sort())?'KEYS-MATCH':'KEYS-DIFFER')"
```
Expected: 全綠 + KEYS-MATCH。

- [ ] **Step 3: 真實瀏覽器驗證**（環境有 Playwright chromium，dev server 用閒置 port，記得收掉）

啟 dev：`cd apps/web && pnpm exec next dev --port 3021 &`（sleep ~11s 待 ready）。用 chromium 腳本（executablePath `/home/royfw/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`，playwright 在 `/home/royfw/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.js`）對 `http://localhost:3021/en/tools/type-converter`：
- 確認輸入框預設 "42"、輸出顯示 "42" + runtimeType "number"
- 改輸入為 "abc" → 輸出顯示錯誤文案（Not a number）
- 開型別 DropdownMenu → 選 boolean / date → 輸出更新
對 `/en/tools/object-flatten`：確認 sample JSON 攤平輸出含 `"user.name"`；輸入打壞 → 顯示 invalid JSON 錯誤。
完成後 `kill` 掉 dev server。若無法跑瀏覽器，註明 manual pending，並至少確認 build 產出該二路由。

- [ ] **Step 4: 更新 `apps/web/README.md`** — Routes 表把 `/tools/[slug]` 註記為「batch 1（type-converter、object-flatten）為真實工具，其餘 coming-soon」。僅改相關行。

- [ ] **Step 5: 確認 workbench 未受影響**

Run: `pnpm -F workbench build`
Expected: 綠（Panel action slot 向後相容；web-core 未動）。

- [ ] **Step 6: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): note batch-1 live tools on /tools/[slug]

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

## Self-Review 紀錄

- **Spec §10 覆蓋**：佈局（並排+Seam，Task 2 ToolShell）✓、Panel action slot（Task 1）✓、batch 1 = type-converter（Task 3）+ object-flatten（Task 4）✓、textarea 非 CodeMirror（Task 4）✓、即時觸發無 debounce（Task 3/4 元件直接算）✓、退役 href（Task 5）✓。jwt-decoder 不在本 plan（Phase 6）✓。
- **Placeholder 掃描**：每個程式步驟皆完整程式碼；錯誤處理是具體分支（nan/invalidDate/invalidJson/notObject），非「加適當錯誤處理」。✓
- **型別/名稱一致**：`ConvertResult`/`convertType`/`CONVERT_TYPES`（Task 3 定義與元件使用）；`FlattenResult`/`flattenJson`（Task 4）；`TOOL_COMPONENTS`（Task 5 定義，[slug] 頁使用）；`ToolShell`（Task 2 定義，Task 3/4 使用，props `operation/input/output`）；`Panel` 的 `action` prop（Task 1 定義，Task 3/4 使用）；`ToolUI.*` message keys（Task 2 定義，Task 3/4 `t("input")`/`t("types.*")`/`t("error.*")` 使用）。✓
- **依賴順序**：Task 1（Panel）→ Task 2（ToolShell+messages）→ Task 3/4（工具，依賴 Panel/ToolShell/messages）→ Task 5（registry 依賴兩工具）→ Task 6（驗證）。
- **未決小風險已設防**：`text-fault` token（Task 3 Step 5 註記先驗證）、lucide icon 名（Task 3 Step 5 註記）、套件 client 安全（Task 6 Step 1 明驗）。
