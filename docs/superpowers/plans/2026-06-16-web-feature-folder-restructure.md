# apps/web feature-folder 重組 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web` 的 quick tools 從「按技術層分」(`lib/tools/` + `components/tools/` + 中央 registry)重組為「按 feature 分」的自足資料夾,co-locate logic / UI / i18n,行為完全不變。

**Architecture:** 每個已實作 tool 一個 `src/tools/<id>/` 資料夾(小 tool 扁平、大 tool 用 `logic/`+`ui/`)。跨 surface 的 catalog(`@rfjs/web-core` 的 `toolRegistry`)不動;app 本地用兩個輕量 aggregator —— `src/tools/index.ts`(`toolModules` + `TOOL_COMPONENTS`)與 `src/tools/messages.ts`(`toolMessages`)。i18n 改為「中央 json + 各 tool 片段 deep-merge」,以 `assembleMessages(locale)` 提供給 `i18n/request.ts`。逐 tool 搬移,每步測試保持全綠。

**Tech Stack:** Next.js(App Router)、next-intl、Vitest(jsdom)、TypeScript、`@/` alias → `src/`。

**起點 baseline:** `pnpm -F web exec vitest run` → 89 passed(18 files)。所有指令在 worktree 根 `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+web-feature-folders` 執行;commit 用 `--no-verify`(fresh worktree 無 husky chain),commit footer:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。commit/PR 一律英文。

---

## File Structure(本案最終形)

```
apps/web/src/
  tools/
    types.ts                    # ToolModule, Locale, LocaleMessages 型別
    index.ts                    # toolModules[] + TOOL_COMPONENTS（components 聚合）
    messages.ts                 # toolMessages[]（只聚合 i18n 片段，不引入 component）
    index.spec.ts               # 守門測試（Task 9 新增）
    _shared/
      tool-shell.tsx            # 由 components/tools/ 搬入（Task 9）
    type-converter/   { type-converter.ts, type-converter.spec.ts, ui.tsx, messages.ts, index.ts }
    object-flatten/   { object-flatten.ts, object-flatten.spec.ts, ui.tsx, messages.ts, index.ts }
    data-filter-tester/ { data-filter-tester.ts, data-filter-tester.spec.ts, ui.tsx, messages.ts, index.ts }
    mongo-query-generator/ { mongo-query-generator.ts, mongo-query-generator.spec.ts, ui.tsx, messages.ts, index.ts }
    jsonb-query-generator/ { jsonb-query-generator.ts, jsonb-query-generator.spec.ts, ui.tsx, messages.ts, index.ts }
    jwt-decoder/      { jwt-decoder.ts, jwt-decoder.spec.ts, ui.tsx, messages.ts, index.ts }
    query-builder/
      logic/ { schema-infer.ts(+spec), compile.ts(+spec), value-coerce.ts(+spec), tree-ops.ts(+spec),
               live-match.ts(+spec), types.ts, engines/{types.ts,arity.ts,jsonb.ts(+spec),data-filter.ts(+spec),index.ts(+spec)}, index.ts }
      ui/ { builder-tree.tsx, schema-panel.tsx, preview-panel.tsx, value-editor.tsx, index.tsx }
      messages.ts
      index.ts
  i18n/
    messages.ts                 # deepMerge + assembleMessages（Task 1 新增）
    messages.spec.ts            # deepMerge/assemble 測試（Task 1 新增）
    request.ts                  # 改用 assembleMessages（Task 1 修改）
  messages/{en,zh-TW}.json      # 保留全域 + 共用 ToolUI + 未實作 tool 的 Tools 條目
```

**ToolUI key 歸屬**(決策已定):
- **留中央(共用/巢狀)**:`input, output, copy, data, filter, matched`,以及巢狀 `types.*`、`error.*`。
- **搬進片段(單一 tool 專用)**:type-converter→`inputValue, targetType`;object-flatten→`jsonInput`;jsonb-query-generator→`column, dialect`;jwt-decoder→`token, header, payload, signature, expiresIn, expired, noExpiry`;query-builder→`notPreviewable, builder, elemMatchPlaceholder`。
- mongo-query-generator、data-filter-tester 無專用 ToolUI key(片段只含 `Tools.<id>`)。

---

## Task 1: i18n merge 基礎建設 + 空 aggregator(零行為變更)

建立合併機制與空的 aggregator;此時 `toolModules`/`toolMessages` 為空,`assembleMessages` 等同中央 json,頁面仍走舊 `components/tools/registry.tsx`。

**Files:**
- Create: `apps/web/src/tools/types.ts`
- Create: `apps/web/src/tools/index.ts`
- Create: `apps/web/src/tools/messages.ts`
- Create: `apps/web/src/i18n/messages.ts`
- Create: `apps/web/src/i18n/messages.spec.ts`
- Modify: `apps/web/src/i18n/request.ts`
- Modify: `apps/web/src/lib/i18n-content.spec.ts`

- [ ] **Step 1: 建立型別與空 aggregator**

`apps/web/src/tools/types.ts`:
```ts
import type { ComponentType } from "react";

import type { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

/** 一個 tool 的 i18n 片段:每個 locale 一份巢狀訊息物件。 */
export type LocaleMessages = Record<Locale, Record<string, unknown>>;

/** apps/web 本地的「實作」registry 條目,以 id 與 @rfjs/web-core catalog 對齊。 */
export interface ToolModule {
  id: string;
  Component: ComponentType;
}
```

`apps/web/src/tools/index.ts`:
```ts
import type { ComponentType } from "react";

import type { ToolModule } from "./types";

// 每搬好一個 tool,就把它的 descriptor 加進這個陣列。
export const toolModules: ToolModule[] = [];

export const TOOL_COMPONENTS: Record<string, ComponentType> = Object.fromEntries(
  toolModules.map((t) => [t.id, t.Component]),
);
```

`apps/web/src/tools/messages.ts`:
```ts
import type { LocaleMessages } from "./types";

// 每搬好一個 tool,就把它的 messages 片段加進這個陣列(只引入 i18n,不引入 component)。
export const toolMessages: LocaleMessages[] = [];
```

- [ ] **Step 2: 寫合併機制(先寫測試)**

`apps/web/src/i18n/messages.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { assembleMessages, deepMerge } from "./messages";
import en from "../messages/en.json";
import zhTW from "../messages/zh-TW.json";

describe("deepMerge", () => {
  it("recursively merges nested objects, override wins on leaves", () => {
    const base = { a: { x: 1, y: 2 }, b: 1 };
    const out = deepMerge(base, { a: { y: 9, z: 3 } });
    expect(out).toEqual({ a: { x: 1, y: 9, z: 3 }, b: 1 });
  });

  it("does not mutate the base object", () => {
    const base = { a: { x: 1 } };
    deepMerge(base, { a: { x: 2 } });
    expect(base).toEqual({ a: { x: 1 } });
  });
});

describe("assembleMessages", () => {
  it("with no tool fragments equals the central catalog", () => {
    expect(assembleMessages("en")).toEqual(en);
    expect(assembleMessages("zh-TW")).toEqual(zhTW);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/i18n/messages.spec.ts`
Expected: FAIL — `Failed to resolve import "./messages"`.

- [ ] **Step 4: 實作 `src/i18n/messages.ts`**

```ts
import type { Locale } from "@/tools/types";
import { toolMessages } from "@/tools/messages";

import en from "../messages/en.json";
import zhTW from "../messages/zh-TW.json";

const central: Record<Locale, Record<string, unknown>> = { en, "zh-TW": zhTW };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const prev = out[k];
    out[k] = isPlainObject(prev) && isPlainObject(v) ? deepMerge(prev, v) : v;
  }
  return out as T;
}

export function assembleMessages(locale: Locale): Record<string, unknown> {
  return toolMessages
    .map((m) => m[locale])
    .reduce<Record<string, unknown>>((acc, frag) => deepMerge(acc, frag), { ...central[locale] });
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F web exec vitest run src/i18n/messages.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: 接上 `request.ts`**

Modify `apps/web/src/i18n/request.ts` — 用 `assembleMessages` 取代直接 import json:
```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { assembleMessages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: assembleMessages(locale),
  };
});
```

- [ ] **Step 7: 讓 `i18n-content.spec.ts` 改測合併結果**

Modify `apps/web/src/lib/i18n-content.spec.ts` — 把直接 import 的 `en` / `zhTW` 換成 `assembleMessages`:
```ts
import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { packageSlug } from "./i18n-content";
import { assembleMessages } from "../i18n/messages";

type Catalog = {
  Tools?: Record<string, { title?: string; description?: string } | undefined>;
  Packages?: Record<string, { description?: string } | undefined>;
};

describe("registry content keys exist in every catalog", () => {
  const catalogs: Record<string, Catalog> = {
    en: assembleMessages("en") as Catalog,
    "zh-TW": assembleMessages("zh-TW") as Catalog,
  };

  it("every tool id has title + description in both locales", () => {
    for (const [loc, msg] of Object.entries(catalogs)) {
      for (const tool of toolRegistry) {
        expect(msg.Tools?.[tool.id]?.title, `${loc} Tools.${tool.id}.title`).toBeTruthy();
        expect(msg.Tools?.[tool.id]?.description, `${loc} Tools.${tool.id}.description`).toBeTruthy();
      }
    }
  });

  it("every package slug has a description in both locales", () => {
    for (const [loc, msg] of Object.entries(catalogs)) {
      for (const pkg of packageRegistry) {
        const slug = packageSlug(pkg.name);
        expect(msg.Packages?.[slug]?.description, `${loc} Packages.${slug}.description`).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 8: 全測 + 型別 + commit**

Run: `pnpm -F web exec vitest run` → Expected: PASS (92 tests: 89 + 3 new).
Run: `pnpm -F web check-types` → Expected: 0 errors.
```bash
git add apps/web/src/tools apps/web/src/i18n apps/web/src/lib/i18n-content.spec.ts
git commit --no-verify -m "$(cat <<'EOF'
refactor(web): add i18n deep-merge and empty tool aggregators

Introduce assembleMessages(locale) merging the central catalog with
per-tool message fragments, wired into i18n/request.ts. Add empty
toolModules / toolMessages aggregators for the feature-folder layout.
No behavior change: with zero fragments, assembleMessages equals the
central catalog.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 搬移 type-converter

**Files:**
- Create: `apps/web/src/tools/type-converter/{type-converter.ts, type-converter.spec.ts, ui.tsx, messages.ts, index.ts}`
- Modify: `apps/web/src/tools/index.ts`, `apps/web/src/tools/messages.ts`
- Modify: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`
- Modify: `apps/web/src/components/tools/registry.tsx`
- Delete: `apps/web/src/lib/tools/type-converter.ts`, `apps/web/src/lib/tools/type-converter.spec.ts`, `apps/web/src/components/tools/type-converter.tsx`

- [ ] **Step 1: 搬 logic(保留內容,連同 spec)**

```bash
git mv apps/web/src/lib/tools/type-converter.ts apps/web/src/tools/type-converter/type-converter.ts
git mv apps/web/src/lib/tools/type-converter.spec.ts apps/web/src/tools/type-converter/type-converter.spec.ts
```
logic 內若 import 同套件的 sibling,維持相對路徑;import `@/lib/...`(非 tool)維持不變。`type-converter.spec.ts` 的 `import ... from "./type-converter"` 仍正確(同資料夾)。

- [ ] **Step 2: 搬 UI 為 `ui.tsx` 並改 import**

```bash
git mv apps/web/src/components/tools/type-converter.tsx apps/web/src/tools/type-converter/ui.tsx
```
編輯 `apps/web/src/tools/type-converter/ui.tsx` 兩行 import:
```ts
// 舊: import { convertType, CONVERT_TYPES } from "@/lib/tools/type-converter";
import { convertType, CONVERT_TYPES } from "./type-converter";
// 舊: import { ToolShell } from "./tool-shell";
import { ToolShell } from "@/components/tools/tool-shell";
```

- [ ] **Step 3: 建 messages 片段**

`apps/web/src/tools/type-converter/messages.ts`:
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "type-converter": {
        title: "Data Type Converter",
        description: "Convert values between string, number, boolean, and date.",
      },
    },
    ToolUI: { inputValue: "Value", targetType: "Target type" },
  },
  "zh-TW": {
    Tools: {
      "type-converter": {
        title: "資料型別轉換器",
        description: "在字串、數字、布林、日期之間轉換值。",
      },
    },
    ToolUI: { inputValue: "值", targetType: "目標型別" },
  },
};
```

- [ ] **Step 4: 建 descriptor**

`apps/web/src/tools/type-converter/index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { TypeConverter } from "./ui";

export const tool: ToolModule = { id: "type-converter", Component: TypeConverter };
```
(若 `ui.tsx` 的 export 名不是 `TypeConverter`,以實際 export 名為準。)

- [ ] **Step 5: 接上 aggregator**

`apps/web/src/tools/index.ts` — import 並加入陣列:
```ts
import { tool as typeConverter } from "./type-converter";
// ...
export const toolModules: ToolModule[] = [typeConverter];
```
`apps/web/src/tools/messages.ts`:
```ts
import { messages as typeConverter } from "./type-converter/messages";
// ...
export const toolMessages: LocaleMessages[] = [typeConverter];
```

- [ ] **Step 6: 從中央 json 移除已搬走的 key**

`apps/web/src/messages/en.json` 與 `zh-TW.json`:刪除 `Tools."type-converter"` 整個物件,並從 `ToolUI` 刪除 `inputValue`、`targetType` 兩鍵。其餘不動。

- [ ] **Step 7: 更新舊 registry import 指向新位置**

`apps/web/src/components/tools/registry.tsx`:
```ts
// 舊: import { TypeConverter } from "./type-converter";
import { TypeConverter } from "@/tools/type-converter/ui";
```

- [ ] **Step 8: 測試 + commit**

Run: `pnpm -F web exec vitest run` → Expected: PASS (92 tests;`assembleMessages` 把 type-converter 片段補回,`i18n-content` 仍綠)。
Run: `pnpm -F web check-types` → Expected: 0 errors。
```bash
git add -A apps/web/src
git commit --no-verify -m "$(cat <<'EOF'
refactor(web): migrate type-converter to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 搬移 object-flatten

同 Task 2 的步驟模式,套用到 object-flatten。

**Files:**
- Create: `apps/web/src/tools/object-flatten/{object-flatten.ts, object-flatten.spec.ts, ui.tsx, messages.ts, index.ts}`
- Modify: `apps/web/src/tools/index.ts`、`apps/web/src/tools/messages.ts`、`apps/web/src/messages/{en,zh-TW}.json`、`apps/web/src/components/tools/registry.tsx`
- Delete: 對應舊檔三個

- [ ] **Step 1: 搬 logic**
```bash
git mv apps/web/src/lib/tools/object-flatten.ts apps/web/src/tools/object-flatten/object-flatten.ts
git mv apps/web/src/lib/tools/object-flatten.spec.ts apps/web/src/tools/object-flatten/object-flatten.spec.ts
```

- [ ] **Step 2: 搬 UI + 改 import**
```bash
git mv apps/web/src/components/tools/object-flatten.tsx apps/web/src/tools/object-flatten/ui.tsx
```
`ui.tsx`:
```ts
import { flattenJson } from "./object-flatten";          // 舊: @/lib/tools/object-flatten
import { ToolShell } from "@/components/tools/tool-shell"; // 舊: ./tool-shell
```

- [ ] **Step 3: messages 片段** — `apps/web/src/tools/object-flatten/messages.ts`:
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "object-flatten": {
        title: "Object Flatten / Unflatten",
        description: "Flatten nested objects to dot-path keys and back.",
      },
    },
    ToolUI: { jsonInput: "JSON" },
  },
  "zh-TW": {
    Tools: {
      "object-flatten": { title: "物件壓平 / 還原", description: "把巢狀物件壓平成點路徑鍵,並可還原。" },
    },
    ToolUI: { jsonInput: "JSON" },
  },
};
```

- [ ] **Step 4: descriptor** — `apps/web/src/tools/object-flatten/index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { ObjectFlatten } from "./ui";

export const tool: ToolModule = { id: "object-flatten", Component: ObjectFlatten };
```

- [ ] **Step 5: aggregator** — `index.ts` 加 `objectFlatten`、`messages.ts` 加 `objectFlatten`(import `./object-flatten` / `./object-flatten/messages`)。

- [ ] **Step 6: 中央 json** — 刪 `Tools."object-flatten"`;從 `ToolUI` 刪 `jsonInput`。

- [ ] **Step 7: registry import** — `import { ObjectFlatten } from "@/tools/object-flatten/ui";`

- [ ] **Step 8: 測試 + commit**
Run: `pnpm -F web exec vitest run` → PASS。`pnpm -F web check-types` → 0。
```bash
git add -A apps/web/src
git commit --no-verify -m "refactor(web): migrate object-flatten to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 搬移 data-filter-tester(片段只含 Tools,無專用 ToolUI)

**Files:** Create `apps/web/src/tools/data-filter-tester/{data-filter-tester.ts, data-filter-tester.spec.ts, ui.tsx, messages.ts, index.ts}`;Modify aggregators + 中央 json + registry;Delete 舊三檔。

- [ ] **Step 1: 搬 logic**
```bash
git mv apps/web/src/lib/tools/data-filter-tester.ts apps/web/src/tools/data-filter-tester/data-filter-tester.ts
git mv apps/web/src/lib/tools/data-filter-tester.spec.ts apps/web/src/tools/data-filter-tester/data-filter-tester.spec.ts
```

- [ ] **Step 2: 搬 UI + 改 import**
```bash
git mv apps/web/src/components/tools/data-filter-tester.tsx apps/web/src/tools/data-filter-tester/ui.tsx
```
`ui.tsx`:
```ts
import { runFilterTest } from "./data-filter-tester";     // 舊: @/lib/tools/data-filter-tester
import { ToolShell } from "@/components/tools/tool-shell"; // 舊: ./tool-shell
```

- [ ] **Step 3: messages 片段** — `messages.ts`(只有 Tools,ToolUI 都是共用,留中央):
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "data-filter-tester": {
        title: "JSONPath Filter Tester",
        description: "Run @rfjs/data-filter conditions against sample data live.",
      },
    },
  },
  "zh-TW": {
    Tools: {
      "data-filter-tester": {
        title: "JSONPath 篩選測試器",
        description: "對範例資料即時執行 @rfjs/data-filter 條件。",
      },
    },
  },
};
```

- [ ] **Step 4: descriptor** — `index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { DataFilterTester } from "./ui";

export const tool: ToolModule = { id: "data-filter-tester", Component: DataFilterTester };
```

- [ ] **Step 5: aggregator** — 加 `dataFilterTester` 到 `index.ts` 與 `messages.ts`。

- [ ] **Step 6: 中央 json** — 只刪 `Tools."data-filter-tester"`(ToolUI 不動)。

- [ ] **Step 7: registry import** — `import { DataFilterTester } from "@/tools/data-filter-tester/ui";`

- [ ] **Step 8: 測試 + commit**
Run: `pnpm -F web exec vitest run` → PASS。`pnpm -F web check-types` → 0。
```bash
git add -A apps/web/src
git commit --no-verify -m "refactor(web): migrate data-filter-tester to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 搬移 mongo-query-generator(片段只含 Tools)

**Files:** Create `apps/web/src/tools/mongo-query-generator/{...}`;Modify aggregators + 中央 json + registry;Delete 舊三檔。

- [ ] **Step 1: 搬 logic**
```bash
git mv apps/web/src/lib/tools/mongo-query-generator.ts apps/web/src/tools/mongo-query-generator/mongo-query-generator.ts
git mv apps/web/src/lib/tools/mongo-query-generator.spec.ts apps/web/src/tools/mongo-query-generator/mongo-query-generator.spec.ts
```

- [ ] **Step 2: 搬 UI + 改 import**
```bash
git mv apps/web/src/components/tools/mongo-query-generator.tsx apps/web/src/tools/mongo-query-generator/ui.tsx
```
`ui.tsx`:
```ts
import { runMongoQuery } from "./mongo-query-generator";   // 舊: @/lib/tools/mongo-query-generator
import { ToolShell } from "@/components/tools/tool-shell";  // 舊: ./tool-shell
```

- [ ] **Step 3: messages 片段** — `messages.ts`:
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "mongo-query-generator": {
        title: "Filter → Mongo Query",
        description: "Generate MongoDB queries from filter metadata.",
      },
    },
  },
  "zh-TW": {
    Tools: {
      "mongo-query-generator": { title: "篩選 → Mongo 查詢", description: "從篩選 metadata 產生 MongoDB 查詢。" },
    },
  },
};
```

- [ ] **Step 4: descriptor** — `index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { MongoQueryGenerator } from "./ui";

export const tool: ToolModule = { id: "mongo-query-generator", Component: MongoQueryGenerator };
```

- [ ] **Step 5: aggregator** — 加 `mongoQueryGenerator`。
- [ ] **Step 6: 中央 json** — 刪 `Tools."mongo-query-generator"`。
- [ ] **Step 7: registry import** — `import { MongoQueryGenerator } from "@/tools/mongo-query-generator/ui";`
- [ ] **Step 8: 測試 + commit**
Run: `pnpm -F web exec vitest run` → PASS。`pnpm -F web check-types` → 0。
```bash
git add -A apps/web/src
git commit --no-verify -m "refactor(web): migrate mongo-query-generator to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 搬移 jsonb-query-generator

**Files:** Create `apps/web/src/tools/jsonb-query-generator/{...}`;Modify aggregators + 中央 json + registry;Delete 舊三檔。

- [ ] **Step 1: 搬 logic**
```bash
git mv apps/web/src/lib/tools/jsonb-query-generator.ts apps/web/src/tools/jsonb-query-generator/jsonb-query-generator.ts
git mv apps/web/src/lib/tools/jsonb-query-generator.spec.ts apps/web/src/tools/jsonb-query-generator/jsonb-query-generator.spec.ts
```

- [ ] **Step 2: 搬 UI + 改 import**
```bash
git mv apps/web/src/components/tools/jsonb-query-generator.tsx apps/web/src/tools/jsonb-query-generator/ui.tsx
```
`ui.tsx`:
```ts
import { JSONB_DIALECTS, runJsonbQuery, type JsonbDialect } from "./jsonb-query-generator"; // 舊: @/lib/tools/...
import { ToolShell } from "@/components/tools/tool-shell"; // 舊: ./tool-shell
```

- [ ] **Step 3: messages 片段** — `messages.ts`(含專用 `column`、`dialect`):
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "jsonb-query-generator": {
        title: "Filter → JSONB SQL",
        description: "Generate PostgreSQL JSONB queries from filter metadata.",
      },
    },
    ToolUI: { column: "Column", dialect: "Dialect" },
  },
  "zh-TW": {
    Tools: {
      "jsonb-query-generator": { title: "篩選 → JSONB SQL", description: "從篩選 metadata 產生 PostgreSQL JSONB 查詢。" },
    },
    ToolUI: { column: "欄位", dialect: "方言" },
  },
};
```

- [ ] **Step 4: descriptor** — `index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { JsonbQueryGenerator } from "./ui";

export const tool: ToolModule = { id: "jsonb-query-generator", Component: JsonbQueryGenerator };
```

- [ ] **Step 5: aggregator** — 加 `jsonbQueryGenerator`。
- [ ] **Step 6: 中央 json** — 刪 `Tools."jsonb-query-generator"`;從 `ToolUI` 刪 `column`、`dialect`。
- [ ] **Step 7: registry import** — `import { JsonbQueryGenerator } from "@/tools/jsonb-query-generator/ui";`
- [ ] **Step 8: 測試 + commit**
Run: `pnpm -F web exec vitest run` → PASS。`pnpm -F web check-types` → 0。
```bash
git add -A apps/web/src
git commit --no-verify -m "refactor(web): migrate jsonb-query-generator to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 搬移 jwt-decoder

**Files:** Create `apps/web/src/tools/jwt-decoder/{...}`;Modify aggregators + 中央 json + registry;Delete 舊三檔。

- [ ] **Step 1: 搬 logic**
```bash
git mv apps/web/src/lib/tools/jwt-decoder.ts apps/web/src/tools/jwt-decoder/jwt-decoder.ts
git mv apps/web/src/lib/tools/jwt-decoder.spec.ts apps/web/src/tools/jwt-decoder/jwt-decoder.spec.ts
```

- [ ] **Step 2: 搬 UI + 改 import**
```bash
git mv apps/web/src/components/tools/jwt-decoder.tsx apps/web/src/tools/jwt-decoder/ui.tsx
```
`ui.tsx`:
```ts
import { decodeJwt, describeExp, formatDuration, type DecodeResult } from "./jwt-decoder"; // 舊: @/lib/tools/jwt-decoder
import { ToolShell } from "@/components/tools/tool-shell"; // 舊: ./tool-shell
```
注意:jwt-decoder 有 server route(`src/app/api/...`)或其他檔可能 import `@/lib/tools/jwt-decoder`。Step 8 前先確認:`grep -rn "lib/tools/jwt-decoder" apps/web/src`,若有命中(非已搬走的檔),改成 `@/tools/jwt-decoder/jwt-decoder`。

- [ ] **Step 3: messages 片段** — `messages.ts`(含專用 `token, header, payload, signature, expiresIn, expired, noExpiry`):
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "jwt-decoder": {
        title: "JWT Decoder",
        description: "Decode a JWT's header and payload, with a live expiry status.",
      },
    },
    ToolUI: {
      token: "JWT",
      header: "Header",
      payload: "Payload",
      signature: "Signature",
      expiresIn: "expires in {duration}",
      expired: "expired",
      noExpiry: "no expiry",
    },
  },
  "zh-TW": {
    Tools: {
      "jwt-decoder": { title: "JWT 解碼器", description: "解碼 JWT 的 header 與 payload，並顯示即時有效期狀態。" },
    },
    ToolUI: {
      token: "JWT",
      header: "Header",
      payload: "Payload",
      signature: "簽章",
      expiresIn: "{duration}後過期",
      expired: "已過期",
      noExpiry: "無有效期",
    },
  },
};
```

- [ ] **Step 4: descriptor** — `index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { JwtDecoder } from "./ui";

export const tool: ToolModule = { id: "jwt-decoder", Component: JwtDecoder };
```

- [ ] **Step 5: aggregator** — 加 `jwtDecoder`。
- [ ] **Step 6: 中央 json** — 刪 `Tools."jwt-decoder"`;從 `ToolUI` 刪 `token, header, payload, signature, expiresIn, expired, noExpiry`。
- [ ] **Step 7: registry import** — `import { JwtDecoder } from "@/tools/jwt-decoder/ui";`
- [ ] **Step 8: 測試 + commit**
Run: `grep -rn "lib/tools/jwt-decoder" apps/web/src` → Expected: 無命中(已全部改完)。
Run: `pnpm -F web exec vitest run` → PASS。`pnpm -F web check-types` → 0。
```bash
git add -A apps/web/src
git commit --no-verify -m "refactor(web): migrate jwt-decoder to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 搬移 query-builder(大 tool:logic/ + ui/)

**Files:**
- Create dir: `apps/web/src/tools/query-builder/logic/`(含 `engines/`)、`apps/web/src/tools/query-builder/ui/`
- Create: `apps/web/src/tools/query-builder/{messages.ts, index.ts}`、`logic/index.ts`
- Modify: aggregators、中央 json、registry、所有搬入檔的 import
- Delete: `apps/web/src/lib/tools/query-builder/`(整個)、`apps/web/src/components/tools/query-builder/`(整個)

- [ ] **Step 1: 搬 logic 整包(含 engines 與 spec)**
```bash
git mv apps/web/src/lib/tools/query-builder apps/web/src/tools/query-builder/logic
```
此時 `logic/` 內含 `schema-infer.ts(+spec)`、`compile.ts(+spec)`、`value-coerce.ts(+spec)`、`tree-ops.ts(+spec)`、`live-match.ts(+spec)`、`types.ts`、`engines/`。logic 內部彼此 import 都是相對路徑(同層),**不需改**。

- [ ] **Step 2: 加 logic barrel** — `apps/web/src/tools/query-builder/logic/index.ts`:
```ts
export * from "./types";
export { inferSchema } from "./schema-infer";
export { treeToFilterGroup } from "./compile";
export { coerceInput } from "./value-coerce";
export { emptyGroup, addCondition, addGroup, setLogic, updateNode, removeNode } from "./tree-ops";
export { runLiveMatch, hasUncoverableOp } from "./live-match";
export { ENGINE_IDS, getEngine } from "./engines";
export type { EngineId, EngineOutput } from "./engines";
export type { LiveMatchResult } from "./live-match";
export type { OperatorArity } from "./engines/types";
```
(以各模組實際 export 名為準;若有出入,以原檔的 export 簽名修正。)

- [ ] **Step 3: 搬 ui 整包**
```bash
git mv apps/web/src/components/tools/query-builder apps/web/src/tools/query-builder/ui
```
`ui/` 內含 `builder-tree.tsx`、`schema-panel.tsx`、`preview-panel.tsx`、`value-editor.tsx`、`index.tsx`。ui 內部彼此 import(`./builder-tree` 等)**不需改**。

- [ ] **Step 4: 改 ui 對 logic 與 tool-shell 的 import**

把 ui 各檔中 `@/lib/tools/query-builder/...` 前綴改為 `@/tools/query-builder/logic/...`;`../tool-shell` 改為 `@/components/tools/tool-shell`。逐檔:

`ui/index.tsx`:
```ts
import { treeToFilterGroup } from "@/tools/query-builder/logic/compile";
import { ENGINE_IDS, getEngine, type EngineId } from "@/tools/query-builder/logic/engines";
import { runLiveMatch } from "@/tools/query-builder/logic/live-match";
import { inferSchema } from "@/tools/query-builder/logic/schema-infer";
import { emptyGroup } from "@/tools/query-builder/logic/tree-ops";
import type { BuilderGroup, FieldSchema } from "@/tools/query-builder/logic/types";
import { ToolShell } from "@/components/tools/tool-shell";
import { GroupNode } from "./builder-tree";
import { PreviewPanel } from "./preview-panel";
import { SchemaPanel } from "./schema-panel";
```
`ui/schema-panel.tsx`:
```ts
import type { FieldSchema, FieldType } from "@/tools/query-builder/logic/types";
```
`ui/builder-tree.tsx`:
```ts
import { getEngine, type EngineId } from "@/tools/query-builder/logic/engines";
import { addCondition, addGroup, removeNode, setLogic, updateNode } from "@/tools/query-builder/logic/tree-ops";
import type { BuilderCondition, BuilderGroup, FieldSchema, LogicOp } from "@/tools/query-builder/logic/types";
```
`ui/value-editor.tsx`:
```ts
import type { OperatorArity } from "@/tools/query-builder/logic/engines/types";
import { coerceInput } from "@/tools/query-builder/logic/value-coerce";
import type { FieldType } from "@/tools/query-builder/logic/types";
```
`ui/preview-panel.tsx`:
```ts
import type { EngineOutput } from "@/tools/query-builder/logic/engines";
import type { LiveMatchResult } from "@/tools/query-builder/logic/live-match";
```
驗證無漏網:`grep -rn "lib/tools/query-builder\|\.\./tool-shell" apps/web/src/tools/query-builder/ui` → 應為空。

- [ ] **Step 5: messages 片段** — `apps/web/src/tools/query-builder/messages.ts`(含專用 `notPreviewable, builder, elemMatchPlaceholder`):
```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "query-builder": {
        title: "Query Builder",
        description: "Build nested JSONB queries visually and preview live matches.",
      },
    },
    ToolUI: {
      notPreviewable: "This operator can't be previewed in the browser",
      builder: "Builder",
      elemMatchPlaceholder: "elemmatch (nested match — single-level in this slice)",
    },
  },
  "zh-TW": {
    Tools: {
      "query-builder": { title: "查詢建構器", description: "視覺化建構巢狀 JSONB 查詢，並即時預覽命中結果。" },
    },
    ToolUI: {
      notPreviewable: "此 operator 無法在瀏覽器預覽",
      builder: "Builder",
      elemMatchPlaceholder: "elemmatch（巢狀比對，本切片暫以單層條件呈現）",
    },
  },
};
```

- [ ] **Step 6: descriptor** — `apps/web/src/tools/query-builder/index.ts`:
```ts
import type { ToolModule } from "@/tools/types";

import { QueryBuilder } from "./ui";

export const tool: ToolModule = { id: "query-builder", Component: QueryBuilder };
```
(`ui/index.tsx` 須 export `QueryBuilder`;以實際 export 名為準。)

- [ ] **Step 7: aggregator** — `index.ts` 加 `queryBuilder`(`from "./query-builder"`);`messages.ts` 加 `queryBuilder`(`from "./query-builder/messages"`)。

- [ ] **Step 8: 中央 json** — 刪 `Tools."query-builder"`;從 `ToolUI` 刪 `notPreviewable, builder, elemMatchPlaceholder`。

- [ ] **Step 9: registry import** — `apps/web/src/components/tools/registry.tsx`:`import { QueryBuilder } from "@/tools/query-builder/ui";`

- [ ] **Step 10: 測試 + commit**
Run: `pnpm -F web exec vitest run` → Expected: PASS(全部 query-builder logic spec 隨之搬移仍綠)。
Run: `pnpm -F web check-types` → 0。
```bash
git add -A apps/web/src
git commit --no-verify -m "refactor(web): migrate query-builder to feature folder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 切換頁面到新 barrel、搬 tool-shell、刪舊 registry、守門測試、完整驗證

此時 7 個 tool 都已在 feature 資料夾,`components/tools/registry.tsx` 只剩「轉介 import」。改頁面直連新 barrel,刪舊 registry,搬 tool-shell,補守門測試。

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/tools/[slug]/page.tsx`
- Delete: `apps/web/src/components/tools/registry.tsx`
- Move: `apps/web/src/components/tools/tool-shell.tsx` → `apps/web/src/tools/_shared/tool-shell.tsx`
- Modify: 7 個 `ui.tsx` / `ui/index.tsx` 對 tool-shell 的 import
- Create: `apps/web/src/tools/index.spec.ts`

- [ ] **Step 1: 頁面改用新 barrel**

先確認舊 import 位置:`grep -n "components/tools/registry" apps/web/src/app/[locale]/(site)/tools/[slug]/page.tsx`。
把 `import { TOOL_COMPONENTS } from "@/components/tools/registry";` 改為 `import { TOOL_COMPONENTS } from "@/tools";`。

- [ ] **Step 2: 刪舊 registry**
```bash
git rm apps/web/src/components/tools/registry.tsx
```

- [ ] **Step 3: 搬 tool-shell 並更新所有 import**
```bash
git mv apps/web/src/components/tools/tool-shell.tsx apps/web/src/tools/_shared/tool-shell.tsx
```
把所有 `@/components/tools/tool-shell` 改為 `@/tools/_shared/tool-shell`:
```bash
grep -rln "components/tools/tool-shell" apps/web/src
```
逐檔(7 個 tool 的 `ui.tsx` / `query-builder/ui/index.tsx`)改 import 為:
```ts
import { ToolShell } from "@/tools/_shared/tool-shell";
```
驗證:`grep -rn "components/tools/tool-shell" apps/web/src` → 應為空。`grep -rn "components/tools/registry" apps/web/src` → 應為空。

- [ ] **Step 4: 守門測試**

`apps/web/src/tools/index.spec.ts`:
```ts
import { toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { TOOL_COMPONENTS, toolModules } from "./index";
import { toolMessages } from "./messages";
import { routing } from "@/i18n/routing";
import en from "@/messages/en.json";
import zhTW from "@/messages/zh-TW.json";

const EXPECTED_WEB_TOOL_IDS = [
  "type-converter",
  "object-flatten",
  "data-filter-tester",
  "mongo-query-generator",
  "jsonb-query-generator",
  "jwt-decoder",
  "query-builder",
].sort();

describe("implementation registry", () => {
  it("registers exactly the expected web tools", () => {
    expect(toolModules.map((t) => t.id).sort()).toEqual(EXPECTED_WEB_TOOL_IDS);
  });

  it("every registered component id exists in the web-core catalog", () => {
    const catalogIds = new Set(toolRegistry.map((t) => t.id));
    for (const id of Object.keys(TOOL_COMPONENTS)) {
      expect(catalogIds.has(id), `catalog missing ${id}`).toBe(true);
    }
  });

  it("component and message aggregators cover the same ids", () => {
    const componentIds = toolModules.map((t) => t.id).sort();
    const messageIds = toolMessages
      .flatMap((m) => Object.keys((m.en.Tools ?? {}) as Record<string, unknown>))
      .sort();
    expect(messageIds).toEqual(componentIds);
  });

  it("tool ToolUI keys never collide with central or each other", () => {
    const central: Record<string, Record<string, unknown>> = { en, "zh-TW": zhTW };
    for (const locale of routing.locales) {
      const seen = new Map<string, string>();
      for (const k of Object.keys((central[locale].ToolUI ?? {}) as Record<string, unknown>)) {
        seen.set(k, "central");
      }
      for (const m of toolMessages) {
        const ui = (m[locale].ToolUI ?? {}) as Record<string, unknown>;
        for (const k of Object.keys(ui)) {
          expect(seen.has(k), `${locale} ToolUI.${k} collides with ${seen.get(k)}`).toBe(false);
          seen.set(k, "fragment");
        }
      }
    }
  });
});
```

- [ ] **Step 5: 完整驗證**

Run: `pnpm -F web exec vitest run` → Expected: PASS(原 89 + Task 1 的 3 + 本 task 4 = 96 tests,0 fail)。
Run: `pnpm -F web check-types` → Expected: 0 errors。
Run: `pnpm -F web lint` → Expected: clean。
Run: `pnpm -F web build` → Expected: 成功,SSG prerender(含 `/tools/[slug]` 各頁)無錯。

- [ ] **Step 6: commit**
```bash
git add -A apps/web/src
git commit --no-verify -m "$(cat <<'EOF'
refactor(web): cut tool registry over to feature folders

Point /tools/[slug] at the assembled src/tools barrel, delete the
hand-maintained components/tools/registry.tsx, relocate the shared
ToolShell into src/tools/_shared, and add guardrail tests for
registry/catalog consistency and ToolUI key collisions.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review(計畫對 spec 的覆蓋)

- **目標結構** → Task 2–8 建立 feature 資料夾;Task 9 建 `_shared/`。✅
- **兩層 registry(catalog 留 web-core)** → 全程不動 `@rfjs/web-core`;Task 1 建 `toolModules`,Task 9 切換頁面 + 守門測試驗證 id 對齊。✅
- **i18n co-locate + 合併** → Task 1 `assembleMessages` + `deepMerge`;Task 2–8 各建片段並從中央 json 移除;歸屬表已明列。✅
- **descriptor 形狀 `{id, Component}`** → 每個 `index.ts`。messages 經獨立 `messages.ts` 聚合(避免把 client component 拉進 i18n server graph)。✅
- **需更新測試** → Task 1 改 `i18n-content.spec.ts` 用 `assembleMessages`;Task 9 加 `tools/index.spec.ts` 守門(catalog 一致性、aggregator 同步、ToolUI 無碰撞)。✅
- **`src/lib/` 非 tool 檔不動** → 僅動 `i18n-content.spec.ts`(spec,屬必要),`nav.ts`/`tool-href.ts` 不碰。✅
- **風險(import、頁面、tool-shell、build)** → Task 4–9 逐一處理並以 grep 驗證無漏網;Task 9 build 驗證 SSG。✅
- **YAGNI 邊界** → 不抽 package(C)、不改 query-builder 功能/畫面(B)、不動 workbench。✅

注:每個 migration task 後 `assembleMessages` 仍涵蓋全部 catalog id(中央 json 縮 + 片段長 = 聯集不變),故 `i18n-content.spec.ts` 全程綠。
