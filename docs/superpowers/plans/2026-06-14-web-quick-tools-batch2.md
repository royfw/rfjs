# Web 快速工具 batch 2（Phase 3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/tools` 剩下 3 個 coming-soon 的工具做成真的互動工具 —— data-filter-tester、mongo-query-generator、jsonb-query-generator —— 套用 batch 1 已建立的 ToolShell 模式,完成後 6 個工具全部為真。

**Architecture:** 每個工具：純邏輯抽 `lib/tools/<tool>.ts`(JSON.parse + 套件函式呼叫,try/catch → 判別式 `{ok:true,...}|{ok:false,error}`),client 元件套 `ToolShell`(上方操作 chip + input/output Panel,batch 1 既有)、各帶 sample 預設值;在 `components/tools/registry.tsx` 的 `TOOL_COMPONENTS` 註冊。`ToolUI` messages 擴充共用標籤。

**Tech Stack:** Next 16 App Router / next-intl 4 / @rfjs/data-filter / @rfjs/mongo-query / @rfjs/jsonb-query / @rfjs/web-ui / vitest

**Spec:** `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md` §10（第二批）

**已實測的 API 事實(寫程式時據此)：**
- `matchQuery(item, filter)`(@rfjs/data-filter)→ boolean。filter = `{logic, filters:[{field, dataType, operator, value}]}`，**dataType 必填**（string/numeric/date/boolean/object/array），缺了會丟 `unsupported dataType`。過濾陣列：`data.filter(d => matchQuery(d, filter))`。型別 `FilterMatchQuery` 已匯出。
- `genFilterQuery(meta)`(@rfjs/mongo-query)→ `LogicalQuery` class 實例，`JSON.stringify` 後為乾淨 Mongo query（如 `{"$and":[{"name":{"$eq":"Ada"}}]}`）。meta = `{logic, filters:[{field, condition, dataType, value}]}`，**用 `condition` 不是 operator**。型別 `MgoFilterMetadata` 已匯出。
- `buildJsonbQuery(column, filter, {dialect})`(@rfjs/jsonb-query)→ `{where, values, from}`。filter = `JsonbFilterGroup` = `{logic, filters:[{field, dataType, operator, value}]}`。dialect: `'legacy'|'jsonpath'`。型別 `JsonbFilterGroup` 已匯出。

**範圍：** 僅這 3 個工具。jwt-decoder 仍在 Phase 6。workbench 不動。

**慣例：** commit subject 小寫開頭（commitlint）。Co-Authored-By 依執行者模型。pre-commit 跑 turbo lint-staged+test。**新增的 `@rfjs/*` dependency 必須與 `pnpm-lock.yaml` 同一個 commit**（batch 1 曾 split 導致 frozen-install 失敗 —— 加完 dep 跑 `pnpm install` 後 `git add package.json pnpm-lock.yaml` 一起 commit，並以 `pnpm install --frozen-lockfile` 驗證）。**worktree 提醒：** 若 `@rfjs/*` 解析失敗先 `pnpm build:packages`。

---

### Task 1: ToolUI messages 擴充（雙站 locale 一致）

**Files:**
- Modify: `apps/web/src/messages/en.json`、`apps/web/src/messages/zh-TW.json`

- [ ] **Step 1: 在兩個 locale 的 `ToolUI` namespace 內，新增 batch 2 需要的鍵**（結構需完全一致）

en.json `ToolUI` 內加：
```json
    "data": "Data",
    "filter": "Filter",
    "column": "Column",
    "dialect": "Dialect",
    "matched": "{count} matched"
```
並在 `ToolUI.error` 物件內加：
```json
    "notArray": "Expected a JSON array",
    "queryFailed": "Could not build the query"
```

zh-TW.json `ToolUI` 內加：
```json
    "data": "資料",
    "filter": "篩選條件",
    "column": "欄位",
    "dialect": "方言",
    "matched": "命中 {count} 筆"
```
`ToolUI.error` 內加：
```json
    "notArray": "需要 JSON 陣列",
    "queryFailed": "無法產生查詢"
```

- [ ] **Step 2: 驗證 JSON 合法 + 雙語 key 一致**

```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+web-quick-tools-batch2
pnpm -F web check-types && pnpm -F web lint
node -e "const a=require('./apps/web/src/messages/en.json'),b=require('./apps/web/src/messages/zh-TW.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);console.log(JSON.stringify(f(a).sort())===JSON.stringify(f(b).sort())?'KEYS-MATCH':'KEYS-DIFFER')"
```
Expected: 綠 + KEYS-MATCH。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json
git commit -m "feat(web): add ToolUI messages for batch-2 quick tools

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 2: data-filter-tester（邏輯 TDD + 元件）

**Files:**
- Create: `apps/web/src/lib/tools/data-filter-tester.ts` + `.spec.ts`
- Create: `apps/web/src/components/tools/data-filter-tester.tsx`
- Modify: `apps/web/package.json` + `pnpm-lock.yaml`（加 `@rfjs/data-filter`）

- [ ] **Step 1: 加 dependency**（若尚未）

```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+web-quick-tools-batch2
```
在 `apps/web/package.json` dependencies 加 `"@rfjs/data-filter": "workspace:*"`，然後 `pnpm install`。**稍後與程式碼同一 commit。**

- [ ] **Step 2: 寫失敗測試** `data-filter-tester.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { runFilterTest } from "./data-filter-tester";

const DATA = '[{"name":"Ada","age":30},{"name":"Bo","age":15}]';
const FILTER = '{"logic":"and","filters":[{"field":"age","dataType":"numeric","operator":"gte","value":18}]}';

describe("runFilterTest", () => {
  it("returns the matched subset and count", () => {
    const r = runFilterTest(DATA, FILTER);
    expect(r).toEqual({ ok: true, output: '[\n  {\n    "name": "Ada",\n    "age": 30\n  }\n]', count: 1 });
  });
  it("rejects invalid JSON in data", () => {
    expect(runFilterTest("nope", FILTER)).toEqual({ ok: false, error: "invalidJson" });
  });
  it("rejects invalid JSON in filter", () => {
    expect(runFilterTest(DATA, "nope")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("rejects non-array data", () => {
    expect(runFilterTest('{"name":"Ada"}', FILTER)).toEqual({ ok: false, error: "notArray" });
  });
  it("reports a filter that throws (e.g. missing dataType) as queryFailed", () => {
    const bad = '{"logic":"and","filters":[{"field":"age","operator":"gte","value":18}]}';
    expect(runFilterTest(DATA, bad)).toEqual({ ok: false, error: "queryFailed" });
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

`pnpm -F web vitest:run` → FAIL（Cannot find module './data-filter-tester'）。（若 fail 在解析 `@rfjs/data-filter`，先做 Step 1 的 dep + 必要時 `pnpm build:packages`。）

- [ ] **Step 4: 實作 `data-filter-tester.ts`**

```ts
import { matchQuery, type FilterMatchQuery } from "@rfjs/data-filter";

export type FilterTestResult =
  | { ok: true; output: string; count: number }
  | { ok: false; error: "invalidJson" | "notArray" | "queryFailed" };

export function runFilterTest(dataText: string, filterText: string): FilterTestResult {
  let data: unknown;
  let filter: unknown;
  try {
    data = JSON.parse(dataText);
    filter = JSON.parse(filterText);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: "notArray" };
  }
  try {
    const matched = data.filter((item) => matchQuery(item, filter as FilterMatchQuery));
    return { ok: true, output: JSON.stringify(matched, null, 2), count: matched.length };
  } catch {
    return { ok: false, error: "queryFailed" };
  }
}
```

- [ ] **Step 5: 跑測試確認通過** — `pnpm -F web vitest:run` → PASS（5 個）。

- [ ] **Step 6: 元件 `data-filter-tester.tsx`**

```tsx
"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { runFilterTest } from "@/lib/tools/data-filter-tester";

import { ToolShell } from "./tool-shell";

const SAMPLE_DATA = `[
  { "name": "Ada", "age": 30 },
  { "name": "Bo", "age": 15 }
]`;
const SAMPLE_FILTER = `{
  "logic": "and",
  "filters": [
    { "field": "age", "dataType": "numeric", "operator": "gte", "value": 18 }
  ]
}`;

export function DataFilterTester() {
  const t = useTranslations("ToolUI");
  const [data, setData] = useState(SAMPLE_DATA);
  const [filter, setFilter] = useState(SAMPLE_FILTER);
  const result = runFilterTest(data, filter);
  const taClass = "w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm";

  return (
    <ToolShell
      operation="matchQuery()"
      input={
        <Panel title={t("input")}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("data")}
              <textarea aria-label={t("data")} value={data} onChange={(e) => setData(e.target.value)} spellCheck={false} rows={6} className={taClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filter")}
              <textarea aria-label={t("filter")} value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} rows={6} className={taClass} />
            </label>
          </div>
        </Panel>
      }
      output={
        <Panel title={t("output")} action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}>
          {result.ok ? (
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">{t("matched", { count: result.count })}</span>
              <pre className="overflow-x-auto font-mono text-sm text-signal">{result.output}</pre>
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

- [ ] **Step 7: 驗證 + Commit**（dep + lockfile + 程式碼同一 commit）

```bash
pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run
pnpm install --frozen-lockfile
git add apps/web/src/lib/tools/data-filter-tester.ts apps/web/src/lib/tools/data-filter-tester.spec.ts apps/web/src/components/tools/data-filter-tester.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): data-filter-tester quick tool (data-filter matchQuery)

Co-Authored-By: <model> <noreply@anthropic.com>"
```
完成後 `git status --porcelain` 應為空。

---

### Task 3: mongo-query-generator（邏輯 TDD + 元件）

**Files:**
- Create: `apps/web/src/lib/tools/mongo-query-generator.ts` + `.spec.ts`
- Create: `apps/web/src/components/tools/mongo-query-generator.tsx`
- Modify: `apps/web/package.json` + `pnpm-lock.yaml`（加 `@rfjs/mongo-query`）

- [ ] **Step 1: 加 dependency** — `"@rfjs/mongo-query": "workspace:*"` 進 apps/web，`pnpm install`（與程式碼同 commit）。

- [ ] **Step 2: 寫失敗測試** `mongo-query-generator.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { runMongoQuery } from "./mongo-query-generator";

const META = '{"logic":"and","filters":[{"field":"name","condition":"eq","dataType":"string","value":"Ada"}]}';

describe("runMongoQuery", () => {
  it("generates a MongoDB query document", () => {
    expect(runMongoQuery(META)).toEqual({ ok: true, output: '{\n  "$and": [\n    {\n      "name": {\n        "$eq": "Ada"\n      }\n    }\n  ]\n}' });
  });
  it("rejects invalid JSON", () => {
    expect(runMongoQuery("nope")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("reports a generation failure as queryFailed", () => {
    expect(runMongoQuery('{"logic":"and"}')).toEqual({ ok: false, error: "queryFailed" });
  });
});
```
（注意：`genFilterQuery` 對缺 `filters` 的 meta 會丟錯 → queryFailed。若實測該 case 不丟而是回空物件，調整這個斷言以符實際 —— 以套件實際行為為準，並註明。）

- [ ] **Step 3: 跑測試確認失敗** — `pnpm -F web vitest:run` → FAIL（module 不存在）。

- [ ] **Step 4: 實作 `mongo-query-generator.ts`**

```ts
import { genFilterQuery, type MgoFilterMetadata } from "@rfjs/mongo-query";

export type MongoQueryResult =
  | { ok: true; output: string }
  | { ok: false; error: "invalidJson" | "queryFailed" };

export function runMongoQuery(metaText: string): MongoQueryResult {
  let meta: unknown;
  try {
    meta = JSON.parse(metaText);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  try {
    const query = genFilterQuery(meta as MgoFilterMetadata);
    return { ok: true, output: JSON.stringify(query, null, 2) };
  } catch {
    return { ok: false, error: "queryFailed" };
  }
}
```

- [ ] **Step 5: 跑測試確認通過** — `pnpm -F web vitest:run` → PASS。

- [ ] **Step 6: 元件 `mongo-query-generator.tsx`**

```tsx
"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { runMongoQuery } from "@/lib/tools/mongo-query-generator";

import { ToolShell } from "./tool-shell";

const SAMPLE = `{
  "logic": "and",
  "filters": [
    { "field": "name", "condition": "eq", "dataType": "string", "value": "Ada" },
    { "field": "age", "condition": "gte", "dataType": "number", "value": 18 }
  ]
}`;

export function MongoQueryGenerator() {
  const t = useTranslations("ToolUI");
  const [text, setText] = useState(SAMPLE);
  const result = runMongoQuery(text);

  return (
    <ToolShell
      operation="genFilterQuery()"
      input={
        <Panel title={t("filter")}>
          <textarea
            aria-label={t("filter")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={10}
            className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
          />
        </Panel>
      }
      output={
        <Panel title={t("output")} action={result.ok ? <CopyButton text={result.output} label={t("copy")} /> : null}>
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

- [ ] **Step 7: 驗證 + Commit**（dep + lockfile 同 commit）

```bash
pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run
pnpm install --frozen-lockfile
git add apps/web/src/lib/tools/mongo-query-generator.ts apps/web/src/lib/tools/mongo-query-generator.spec.ts apps/web/src/components/tools/mongo-query-generator.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): mongo-query-generator quick tool (mongo-query genFilterQuery)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 4: jsonb-query-generator（邏輯 TDD + 元件，含 dialect 選擇）

**Files:**
- Create: `apps/web/src/lib/tools/jsonb-query-generator.ts` + `.spec.ts`
- Create: `apps/web/src/components/tools/jsonb-query-generator.tsx`
- Modify: `apps/web/package.json` + `pnpm-lock.yaml`（加 `@rfjs/jsonb-query`）

- [ ] **Step 1: 加 dependency** — `"@rfjs/jsonb-query": "workspace:*"` 進 apps/web，`pnpm install`（與程式碼同 commit）。

- [ ] **Step 2: 寫失敗測試** `jsonb-query-generator.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { JSONB_DIALECTS, runJsonbQuery } from "./jsonb-query-generator";

const FILTER = '{"logic":"and","filters":[{"field":"age","dataType":"numeric","operator":"gt","value":18}]}';

describe("runJsonbQuery", () => {
  it("builds a parameterized where + values (legacy)", () => {
    const r = runJsonbQuery("data", FILTER, "legacy");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.where).toBe('(("data" #>> $1)::numeric > $2)');
      expect(r.values).toBe('[\n  [\n    "age"\n  ],\n  18\n]');
    }
  });
  it("rejects invalid JSON", () => {
    expect(runJsonbQuery("data", "nope", "legacy")).toEqual({ ok: false, error: "invalidJson" });
  });
  it("reports a build failure as queryFailed", () => {
    expect(runJsonbQuery("data", '{"logic":"and"}', "legacy")).toEqual({ ok: false, error: "queryFailed" });
  });
  it("exposes the two dialects", () => {
    expect(JSONB_DIALECTS).toEqual(["legacy", "jsonpath"]);
  });
});
```
（`{"logic":"and"}` 缺 filters 是否丟錯 → 以套件實際為準調整；若回空 where 而不丟，改斷言並註明。）

- [ ] **Step 3: 跑測試確認失敗** — `pnpm -F web vitest:run` → FAIL。

- [ ] **Step 4: 實作 `jsonb-query-generator.ts`**

```ts
import { buildJsonbQuery, type JsonbFilterGroup } from "@rfjs/jsonb-query";

export type JsonbDialect = "legacy" | "jsonpath";
export const JSONB_DIALECTS: JsonbDialect[] = ["legacy", "jsonpath"];

export type JsonbQueryResult =
  | { ok: true; where: string; values: string }
  | { ok: false; error: "invalidJson" | "queryFailed" };

export function runJsonbQuery(column: string, filterText: string, dialect: JsonbDialect): JsonbQueryResult {
  let filter: unknown;
  try {
    filter = JSON.parse(filterText);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  try {
    const { where, values } = buildJsonbQuery(column || "data", filter as JsonbFilterGroup, { dialect });
    return { ok: true, where, values: JSON.stringify(values, null, 2) };
  } catch {
    return { ok: false, error: "queryFailed" };
  }
}
```

- [ ] **Step 5: 跑測試確認通過** — `pnpm -F web vitest:run` → PASS。

- [ ] **Step 6: 元件 `jsonb-query-generator.tsx`**（column 文字框 + dialect DropdownMenu + filter textarea；DropdownMenu 用法鏡像 type-converter）

```tsx
"use client";

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

import { JSONB_DIALECTS, runJsonbQuery, type JsonbDialect } from "@/lib/tools/jsonb-query-generator";

import { ToolShell } from "./tool-shell";

const SAMPLE = `{
  "logic": "and",
  "filters": [
    { "field": "age", "dataType": "numeric", "operator": "gt", "value": 18 }
  ]
}`;

export function JsonbQueryGenerator() {
  const t = useTranslations("ToolUI");
  const [column, setColumn] = useState("data");
  const [dialect, setDialect] = useState<JsonbDialect>("legacy");
  const [filter, setFilter] = useState(SAMPLE);
  const result = runJsonbQuery(column, filter, dialect);

  return (
    <ToolShell
      operation="buildJsonbQuery()"
      input={
        <Panel title={t("input")}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("column")}
              <input aria-label={t("column")} value={column} onChange={(e) => setColumn(e.target.value)} className="w-full rounded-sm border bg-transparent px-2 py-1.5 font-mono text-sm" />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={t("dialect")} className="justify-between gap-2">
                  {dialect}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {JSONB_DIALECTS.map((d) => (
                  <DropdownMenuItem key={d} onSelect={() => setDialect(d)}>
                    <Check className={d === dialect ? "size-4 opacity-100" : "size-4 opacity-0"} />
                    {d}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {t("filter")}
              <textarea aria-label={t("filter")} value={filter} onChange={(e) => setFilter(e.target.value)} spellCheck={false} rows={8} className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm" />
            </label>
          </div>
        </Panel>
      }
      output={
        <Panel title={t("output")} action={result.ok ? <CopyButton text={result.where} label={t("copy")} /> : null}>
          {result.ok ? (
            <div className="flex flex-col gap-2">
              <pre className="overflow-x-auto font-mono text-sm text-signal">{result.where}</pre>
              <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{result.values}</pre>
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

- [ ] **Step 7: 驗證 + Commit**（dep + lockfile 同 commit）

```bash
pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run
pnpm install --frozen-lockfile
git add apps/web/src/lib/tools/jsonb-query-generator.ts apps/web/src/lib/tools/jsonb-query-generator.spec.ts apps/web/src/components/tools/jsonb-query-generator.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): jsonb-query-generator quick tool (jsonb-query buildJsonbQuery)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 5: 註冊 3 工具 + 全面驗證 + README

**Files:**
- Modify: `apps/web/src/components/tools/registry.tsx`
- Modify: `apps/web/README.md`

- [ ] **Step 1: 在 `registry.tsx` 的 `TOOL_COMPONENTS` 註冊 3 個工具**

讀現檔（目前含 type-converter、object-flatten），加 import 與三個 map 條目，使其成為：
```tsx
import type { ComponentType } from "react";

import { DataFilterTester } from "./data-filter-tester";
import { JsonbQueryGenerator } from "./jsonb-query-generator";
import { MongoQueryGenerator } from "./mongo-query-generator";
import { ObjectFlatten } from "./object-flatten";
import { TypeConverter } from "./type-converter";

// Web quick tools with a live implementation. Tool ids absent here render the
// "coming soon" placeholder on /tools/[slug].
export const TOOL_COMPONENTS: Record<string, ComponentType> = {
  "type-converter": TypeConverter,
  "object-flatten": ObjectFlatten,
  "data-filter-tester": DataFilterTester,
  "mongo-query-generator": MongoQueryGenerator,
  "jsonb-query-generator": JsonbQueryGenerator,
};
```

- [ ] **Step 2: 全 sweep + frozen-install**

```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+web-quick-tools-batch2
rm -rf apps/web/.next
pnpm install --frozen-lockfile
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build
node -e "const a=require('./apps/web/src/messages/en.json'),b=require('./apps/web/src/messages/zh-TW.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);console.log(JSON.stringify(f(a).sort())===JSON.stringify(f(b).sort())?'KEYS-MATCH':'KEYS-DIFFER')"
pnpm -F workbench build
```
Expected: 全綠 + KEYS-MATCH；workbench 不受影響（web-core schema 未動）。

- [ ] **Step 3: 真實瀏覽器驗證**（環境有 Playwright chromium）

`pnpm -F web start --port 3031 &`（sleep 4）。chromium（executablePath `/home/royfw/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`，playwright `/home/royfw/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.js`）逐一開：
- `/en/tools/data-filter-tester`：sample 應輸出 1 筆命中（Ada）+「1 matched」；改 filter value 為 100 → 0 筆
- `/en/tools/mongo-query-generator`：sample 應輸出含 `$and`/`$eq` 的 JSON；打壞 JSON → invalidJson 錯誤
- `/en/tools/jsonb-query-generator`：sample 應輸出 `where` 含 `::numeric`；切 dialect 到 jsonpath → where 改變
收掉 server。若無瀏覽器，以 curl 確認三個路由 200 並註明 manual 互動 pending。

- [ ] **Step 4: README** — `apps/web/README.md` 的 `/tools` 行更新為「全部 6 個 quick tools 皆為真實互動工具」。僅改該行。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tools/registry.tsx apps/web/README.md
git commit -m "feat(web): register batch-2 tools on /tools/[slug]; all six tools live now

Co-Authored-By: <model> <noreply@anthropic.com>"
```

## Self-Review 紀錄

- **Spec §10 第二批覆蓋**：data-filter-tester（Task 2，data+filter→matched subset+count）✓、mongo-query-generator（Task 3，meta→Mongo doc）✓、jsonb-query-generator（Task 4，column+dialect+filter→where+values）✓、各 sample 預設 ✓、註冊（Task 5）✓。jwt-decoder 不在範圍 ✓。
- **Placeholder 掃描**：每步完整程式碼；錯誤碼具體（invalidJson/notArray/queryFailed）。兩處「以套件實際行為為準調整斷言」附了明確判斷依據（缺 filters 是否丟錯），非空泛。
- **型別/名稱一致**：`runFilterTest`/`runMongoQuery`/`runJsonbQuery` + `JSONB_DIALECTS`/`JsonbDialect`（各 lib 定義、各元件使用）；`TOOL_COMPONENTS` 既有 + 加 3（Task 5）；`ToolUI` 新鍵（Task 1 定義，Task 2/3/4 `t("data")`/`t("filter")`/`t("column")`/`t("dialect")`/`t("matched")`/`t("error.*")` 使用）；condition vs operator 差異（mongo 用 condition、其餘 operator）已在各 sample 反映。
- **依賴順序**：Task 1（messages）先 → Task 2/3/4（各工具,各自加 dep+lockfile 同 commit）→ Task 5（註冊 + 驗證）。
- **關鍵風險已設防**：dep/lockfile split（每個工具 task 明列 frozen-install 驗證 + dep 與程式同 commit）；data-filter dataType 必填（sample 已含、且有一條測試驗證缺 dataType → queryFailed）；mongo condition≠operator（sample 正確）;LogicalQuery 序列化（已實測 `JSON.stringify` 乾淨,測試斷言據此）。
