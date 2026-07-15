# Metadata 驅動的巢狀查詢建構器 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 新增一個引擎感知的視覺化巢狀查詢建構器工具 `query-builder`:貼範例 JSON → 推斷可編輯 schema → 用遞迴 logic 樹組條件 → 同時預覽 jsonb SQL 與 data-filter 即時命中。

**Architecture:** 一棵帶 `id` 的 canonical tree(`BuilderGroup`/`BuilderCondition`),配一個 `engine → operator 矩陣 + compile()` 的 registry。純邏輯(schema 推斷、tree↔filter-group 序列化、值強制轉型、引擎矩陣與編譯、即時比對、tree 變更操作)全部抽成可測函式並以 co-located `*.spec.ts` 測試;React 元件保持薄殼,以 `check-types` + `lint` + 手動 dev 驗證。

**Tech Stack:** Next.js (apps/web)、React、next-intl、Vitest(jsdom)、`@rfjs/jsonb-query`、`@rfjs/data-filter`、`@rfjs/web-ui`、`@rfjs/web-core`。

**參考設計文件:** `docs/superpowers/specs/2026-06-14-query-builder-nested-design.md`

---

## 與設計文件的差異(已決定的簡化)

- `OperatorSpec` 不帶 i18n `label`,UI 直接以 mono 顯示 operator token;只有 group 的 `logic` 用友善雙語標籤(寫在元件)。降低 i18n 負擔。
- 條件的 `value` 儲存為**已轉型的值**(number / boolean / string / string[] / [n,n]),由值編輯器透過純函式 `coerceInput()` 產生;`treeToFilterGroup()` 只負責剝 `id` 與丟棄未完成條件。

---

## 檔案結構

```
apps/web/src/lib/tools/query-builder/
  types.ts            # LogicOp, ScalarType, BuilderGroup, BuilderCondition, BuilderItem, FieldSchema
  schema-infer.ts     # inferSchema(rows) -> FieldSchema[]
  compile.ts          # treeToFilterGroup(group) -> FilterGroupLike（剝 id、丟未完成）
  value-coerce.ts     # coerceInput(dataType, arity, raw) -> 已轉型值
  tree-ops.ts         # 純樹變更：addGroup/addCondition/updateNode/removeNode/setLogic
  live-match.ts       # runLiveMatch(rows, group) -> { matched, count, uncoverable }
  engines/
    types.ts          # OperatorArity, OperatorSpec, EngineOutput, Engine, EngineId
    arity.ts          # ARITY: Record<operator, OperatorArity>
    jsonb.ts          # jsonbEngine（矩陣 + compile via buildJsonbQuery）
    data-filter.ts    # dataFilterEngine（矩陣 + compile via JSON.stringify）+ DATA_FILTER_OPS（覆蓋率用）
    index.ts          # ENGINES registry, getEngine, ENGINE_IDS
apps/web/src/components/tools/query-builder/
  index.tsx           # QueryBuilder（state 中樞，組合 ToolShell）
  schema-panel.tsx    # 貼資料 + 可編輯欄位清單
  builder-tree.tsx    # GroupNode（遞迴）+ ConditionRow
  value-editor.tsx    # 依 dataType + arity 的值輸入
  preview-panel.tsx   # 主引擎輸出 + 即時命中
apps/web/src/components/tools/registry.tsx          # 註冊 "query-builder"
packages/web-core/src/registry/tools.ts             # toolRegistry 新增項目
apps/web/src/messages/en.json, zh-TW.json           # Tools.query-builder + ToolUI keys
```

---

## Task 0: Worktree 設定與基線

**Files:** 無(環境)

- [ ] **Step 1: 安裝相依**

Run（在 worktree 根目錄):
```bash
pnpm install
```
Expected: 安裝完成、無錯誤。

- [ ] **Step 2: 基線測試(apps/web)**

Run:
```bash
pnpm -F web test
```
Expected: 既有測試全綠(現有 tool 的 `*.spec.ts`)。若有既存失敗,先回報再決定是否繼續。

---

## Task 1: Canonical 型別 + schema 推斷

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/types.ts`
- Create: `apps/web/src/lib/tools/query-builder/schema-infer.ts`
- Test: `apps/web/src/lib/tools/query-builder/schema-infer.spec.ts`

- [ ] **Step 1: 建立型別檔(無測試,類型由後續任務使用)**

`apps/web/src/lib/tools/query-builder/types.ts`:
```ts
export type LogicOp = "and" | "or" | "nor" | "not";
export type ScalarType = "string" | "numeric" | "date" | "boolean";
export type FieldType = ScalarType | "object" | "array";
export type ElementType = ScalarType | "object";

export interface BuilderGroup {
  kind: "group";
  id: string;
  logic: LogicOp;
  children: BuilderItem[];
}

export interface BuilderCondition {
  kind: "condition";
  id: string;
  field: string;
  dataType: FieldType;
  elementType?: ElementType; // 當 dataType === "array"
  operator: string; // 對所選引擎矩陣驗證
  value?: unknown; // 已轉型值（見 value-coerce）
  filters?: BuilderGroup; // 當 operator === "elemmatch"
}

export type BuilderItem = BuilderGroup | BuilderCondition;

export interface FieldSchema {
  path: string;
  dataType: FieldType;
  elementType?: ElementType;
  include: boolean;
}
```

- [ ] **Step 2: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/schema-infer.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { inferSchema } from "./schema-infer";

describe("inferSchema", () => {
  it("infers scalar types from the first non-null value", () => {
    const s = inferSchema([{ name: "a", age: 30, active: true }]);
    expect(s).toEqual([
      { path: "name", dataType: "string", include: true },
      { path: "age", dataType: "numeric", include: true },
      { path: "active", dataType: "boolean", include: true },
    ]);
  });

  it("detects ISO date strings as date", () => {
    expect(inferSchema([{ created: "2020-01-15" }])).toEqual([
      { path: "created", dataType: "date", include: true },
    ]);
  });

  it("emits both the object field and its leaf paths", () => {
    expect(inferSchema([{ address: { city: "TP" } }])).toEqual([
      { path: "address", dataType: "object", include: true },
      { path: "address.city", dataType: "string", include: true },
    ]);
  });

  it("infers arrays of scalars with elementType", () => {
    expect(inferSchema([{ tags: ["a", "b"] }])).toEqual([
      { path: "tags", dataType: "array", elementType: "string", include: true },
    ]);
  });

  it("infers arrays of objects as elementType object", () => {
    expect(inferSchema([{ items: [{ sku: "x" }] }])).toEqual([
      { path: "items", dataType: "array", elementType: "object", include: true },
    ]);
  });

  it("falls back to string on conflicting types across rows", () => {
    expect(inferSchema([{ v: 1 }, { v: "x" }])).toEqual([
      { path: "v", dataType: "string", include: true },
    ]);
  });

  it("throws when input is not an array of objects", () => {
    expect(() => inferSchema(42 as unknown)).toThrow();
    expect(() => inferSchema([1, 2] as unknown)).toThrow();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/schema-infer.spec.ts`
Expected: FAIL(`inferSchema` 不存在)。

- [ ] **Step 4: 實作**

`apps/web/src/lib/tools/query-builder/schema-infer.ts`:
```ts
import type { ElementType, FieldSchema, FieldType, ScalarType } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

function scalarOf(v: unknown): ScalarType {
  if (typeof v === "number") return "numeric";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "string" && ISO_DATE.test(v)) return "date";
  return "string";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function elementTypeOf(arr: unknown[]): ElementType {
  const first = arr.find((x) => x !== null && x !== undefined);
  if (isPlainObject(first)) return "object";
  return scalarOf(first);
}

function fieldTypeOf(v: unknown): { dataType: FieldType; elementType?: ElementType } {
  if (Array.isArray(v)) return { dataType: "array", elementType: elementTypeOf(v) };
  if (isPlainObject(v)) return { dataType: "object" };
  return { dataType: scalarOf(v) };
}

// path -> 第一個觀察到的型別簽章；衝突標記為 string
function walk(
  obj: Record<string, unknown>,
  prefix: string,
  acc: Map<string, { dataType: FieldType; elementType?: ElementType }>,
): void {
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const inferred = fieldTypeOf(value);
    const prev = acc.get(path);
    if (prev && (prev.dataType !== inferred.dataType || prev.elementType !== inferred.elementType)) {
      acc.set(path, { dataType: "string" }); // 衝突 → string
    } else if (!prev) {
      acc.set(path, inferred);
    }
    if (inferred.dataType === "object") walk(value as Record<string, unknown>, path, acc);
  }
}

export function inferSchema(rows: unknown): FieldSchema[] {
  if (!Array.isArray(rows)) throw new Error("expected an array of objects");
  const acc = new Map<string, { dataType: FieldType; elementType?: ElementType }>();
  for (const row of rows) {
    if (!isPlainObject(row)) throw new Error("expected an array of objects");
    walk(row, "", acc);
  }
  return [...acc.entries()].map(([path, t]) => ({
    path,
    dataType: t.dataType,
    ...(t.elementType ? { elementType: t.elementType } : {}),
    include: true,
  }));
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/schema-infer.spec.ts`
Expected: PASS(7 個測試)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/types.ts apps/web/src/lib/tools/query-builder/schema-infer.ts apps/web/src/lib/tools/query-builder/schema-infer.spec.ts
git commit --no-verify -m "feat(web/query-builder): canonical types + schema inference"
```

---

## Task 2: tree → filter-group 序列化

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/compile.ts`
- Test: `apps/web/src/lib/tools/query-builder/compile.spec.ts`

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/compile.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "./compile";
import type { BuilderGroup } from "./types";

const g = (over: Partial<BuilderGroup> = {}): BuilderGroup => ({
  kind: "group",
  id: "g",
  logic: "and",
  children: [],
  ...over,
});

describe("treeToFilterGroup", () => {
  it("strips ids and produces logic + filters", () => {
    const tree = g({
      children: [
        { kind: "condition", id: "c1", field: "age", dataType: "numeric", operator: "gt", value: 18 },
      ],
    });
    expect(treeToFilterGroup(tree)).toEqual({
      logic: "and",
      filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 18 }],
    });
  });

  it("drops conditions missing field or operator", () => {
    const tree = g({
      children: [
        { kind: "condition", id: "c1", field: "", dataType: "string", operator: "eq", value: "x" },
        { kind: "condition", id: "c2", field: "name", dataType: "string", operator: "", value: "y" },
        { kind: "condition", id: "c3", field: "name", dataType: "string", operator: "eq", value: "z" },
      ],
    });
    expect(treeToFilterGroup(tree).filters).toEqual([
      { field: "name", dataType: "string", operator: "eq", value: "z" },
    ]);
  });

  it("recurses into nested groups", () => {
    const tree = g({
      logic: "or",
      children: [g({ id: "g2", logic: "nor", children: [] })],
    });
    expect(treeToFilterGroup(tree)).toEqual({
      logic: "or",
      filters: [{ logic: "nor", filters: [] }],
    });
  });

  it("preserves elemmatch nested filters and elementType", () => {
    const tree = g({
      children: [
        {
          kind: "condition", id: "c1", field: "items", dataType: "array", elementType: "object", operator: "elemmatch",
          filters: g({ id: "gi", logic: "and", children: [
            { kind: "condition", id: "ci", field: "sku", dataType: "string", operator: "eq", value: "x" },
          ] }),
        },
      ],
    });
    expect(treeToFilterGroup(tree)).toEqual({
      logic: "and",
      filters: [{
        field: "items", dataType: "array", elementType: "object", operator: "elemmatch",
        filters: { logic: "and", filters: [{ field: "sku", dataType: "string", operator: "eq", value: "x" }] },
      }],
    });
  });

  it("omits value for no-arity operators when value is undefined", () => {
    const tree = g({
      children: [{ kind: "condition", id: "c1", field: "name", dataType: "string", operator: "isnull" }],
    });
    expect(treeToFilterGroup(tree).filters).toEqual([
      { field: "name", dataType: "string", operator: "isnull" },
    ]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/compile.spec.ts`
Expected: FAIL(`treeToFilterGroup` 不存在)。

- [ ] **Step 3: 實作**

`apps/web/src/lib/tools/query-builder/compile.ts`:
```ts
import type { BuilderCondition, BuilderGroup, BuilderItem } from "./types";

// 與 @rfjs/jsonb-query / @rfjs/data-filter 共用的結構性 filter 形狀（無 id）。
export interface FilterGroupLike {
  logic: string;
  filters: Array<FilterConditionLike | FilterGroupLike>;
}
export interface FilterConditionLike {
  field: string;
  dataType: string;
  elementType?: string;
  operator: string;
  value?: unknown;
  filters?: FilterGroupLike;
}

function isComplete(c: BuilderCondition): boolean {
  return c.field.length > 0 && c.operator.length > 0;
}

function conditionToFilter(c: BuilderCondition): FilterConditionLike {
  const out: FilterConditionLike = { field: c.field, dataType: c.dataType, operator: c.operator };
  if (c.elementType) out.elementType = c.elementType;
  if (c.operator === "elemmatch" && c.filters) {
    out.filters = treeToFilterGroup(c.filters);
  } else if (c.value !== undefined) {
    out.value = c.value;
  }
  return out;
}

export function treeToFilterGroup(group: BuilderGroup): FilterGroupLike {
  const filters: FilterGroupLike["filters"] = [];
  for (const child of group.children as BuilderItem[]) {
    if (child.kind === "group") filters.push(treeToFilterGroup(child));
    else if (isComplete(child)) filters.push(conditionToFilter(child));
  }
  return { logic: group.logic, filters };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/compile.spec.ts`
Expected: PASS(5 個測試)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/compile.ts apps/web/src/lib/tools/query-builder/compile.spec.ts
git commit --no-verify -m "feat(web/query-builder): tree to filter-group serialization"
```

---

## Task 3: 值強制轉型

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/engines/types.ts`
- Create: `apps/web/src/lib/tools/query-builder/value-coerce.ts`
- Test: `apps/web/src/lib/tools/query-builder/value-coerce.spec.ts`

- [ ] **Step 1: 建立引擎共用型別(供 arity 使用)**

`apps/web/src/lib/tools/query-builder/engines/types.ts`:
```ts
import type { FilterGroupLike } from "../compile";

export type OperatorArity = "none" | "one" | "two" | "list";

export interface OperatorSpec {
  op: string;
  arity: OperatorArity;
}

export type EngineId = "jsonb" | "data-filter";

export type EngineOutput =
  | { ok: true; primary: string; secondary?: string }
  | { ok: false; error: string };

export interface Engine {
  id: EngineId;
  label: string;
  operators(dataType: string, elementType?: string): OperatorSpec[];
  compile(group: FilterGroupLike): EngineOutput;
}
```

- [ ] **Step 2: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/value-coerce.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { coerceInput } from "./value-coerce";

describe("coerceInput", () => {
  it("coerces numeric one-arity to a number", () => {
    expect(coerceInput("numeric", "one", "18")).toBe(18);
  });

  it("returns NaN-free fallback: non-numeric string stays string", () => {
    expect(coerceInput("numeric", "one", "abc")).toBe("abc");
  });

  it("coerces boolean to a real boolean", () => {
    expect(coerceInput("boolean", "one", "true")).toBe(true);
    expect(coerceInput("boolean", "one", "false")).toBe(false);
  });

  it("keeps string/date one-arity as a string", () => {
    expect(coerceInput("string", "one", "hello")).toBe("hello");
    expect(coerceInput("date", "one", "2020-01-01")).toBe("2020-01-01");
  });

  it("splits list arity on comma/newline, trimming and dropping empties", () => {
    expect(coerceInput("string", "list", "a, b\n c ")).toEqual(["a", "b", "c"]);
  });

  it("coerces each list element by dataType for numeric", () => {
    expect(coerceInput("numeric", "list", "1, 2, 3")).toEqual([1, 2, 3]);
  });

  it("parses two-arity range into a typed pair", () => {
    expect(coerceInput("numeric", "two", "1, 9")).toEqual([1, 9]);
  });

  it("returns undefined for none arity", () => {
    expect(coerceInput("string", "none", "ignored")).toBeUndefined();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/value-coerce.spec.ts`
Expected: FAIL(`coerceInput` 不存在)。

- [ ] **Step 4: 實作**

`apps/web/src/lib/tools/query-builder/value-coerce.ts`:
```ts
import type { OperatorArity } from "./engines/types";
import type { FieldType } from "./types";

function coerceScalar(dataType: string, raw: string): string | number | boolean {
  if (dataType === "numeric") {
    const n = Number(raw);
    return raw.trim() !== "" && !Number.isNaN(n) ? n : raw;
  }
  if (dataType === "boolean") return raw.trim().toLowerCase() === "true";
  return raw; // string / date 保持字串
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function coerceInput(
  dataType: FieldType | string,
  arity: OperatorArity,
  raw: string,
): unknown {
  if (arity === "none") return undefined;
  if (arity === "list") return splitList(raw).map((s) => coerceScalar(dataType, s));
  if (arity === "two") {
    const [a, b] = splitList(raw);
    return [coerceScalar(dataType, a ?? ""), coerceScalar(dataType, b ?? "")];
  }
  return coerceScalar(dataType, raw);
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/value-coerce.spec.ts`
Expected: PASS(8 個測試)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/engines/types.ts apps/web/src/lib/tools/query-builder/value-coerce.ts apps/web/src/lib/tools/query-builder/value-coerce.spec.ts
git commit --no-verify -m "feat(web/query-builder): engine types + value coercion"
```

---

## Task 4: operator arity 表 + jsonb 引擎

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/engines/arity.ts`
- Create: `apps/web/src/lib/tools/query-builder/engines/jsonb.ts`
- Test: `apps/web/src/lib/tools/query-builder/engines/jsonb.spec.ts`

- [ ] **Step 1: 建立 arity 表(無測試,被引擎使用)**

`apps/web/src/lib/tools/query-builder/engines/arity.ts`:
```ts
import type { OperatorArity } from "./types";

// 每個 operator 的值參數數量。未列出者預設 "one"。
export const ARITY: Record<string, OperatorArity> = {
  isnull: "none",
  isnotnull: "none",
  isempty: "none",
  isnotempty: "none",
  elemmatch: "none",
  range: "two",
  terms: "list",
  containsall: "list",
  hasanykey: "list",
  hasallkeys: "list",
};

export function arityOf(op: string): OperatorArity {
  return ARITY[op] ?? "one";
}
```

- [ ] **Step 2: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/engines/jsonb.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { jsonbEngine } from "./jsonb";

describe("jsonbEngine.operators", () => {
  it("offers case-insensitive + substring ops for string", () => {
    const ops = jsonbEngine.operators("string").map((o) => o.op);
    expect(ops).toContain("icontains");
    expect(ops).toContain("contains");
    expect(ops).not.toContain("gt"); // 字串不給比較大小
  });

  it("offers comparison ops for numeric, with correct arity", () => {
    const ops = jsonbEngine.operators("numeric");
    expect(ops.map((o) => o.op)).toEqual(
      expect.arrayContaining(["eq", "gt", "gte", "lt", "lte", "range", "terms"]),
    );
    expect(ops.find((o) => o.op === "range")?.arity).toBe("two");
    expect(ops.find((o) => o.op === "terms")?.arity).toBe("list");
  });

  it("offers haskey family for object", () => {
    const ops = jsonbEngine.operators("object").map((o) => o.op);
    expect(ops).toEqual(expect.arrayContaining(["haskey", "hasanykey", "hasallkeys", "contains"]));
  });

  it("offers only elemmatch for arrays of objects", () => {
    expect(jsonbEngine.operators("array", "object").map((o) => o.op)).toEqual(["elemmatch"]);
  });

  it("offers isempty/isnotempty for scalar arrays", () => {
    const ops = jsonbEngine.operators("array", "string").map((o) => o.op);
    expect(ops).toEqual(expect.arrayContaining(["contains", "containsall", "isempty", "isnotempty"]));
  });
});

describe("jsonbEngine.compile", () => {
  const tree: BuilderGroup = {
    kind: "group", id: "g", logic: "and",
    children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 18 }],
  };

  it("produces a parameterized where + values", () => {
    const out = jsonbEngine.compile(treeToFilterGroup(tree));
    expect(out).toEqual({
      ok: true,
      primary: '(("data" #>> $1)::numeric > $2)',
      secondary: '[\n  [\n    "age"\n  ],\n  18\n]',
    });
  });

  it("reports a build failure as an error result", () => {
    const out = jsonbEngine.compile({ logic: "and", filters: [{ field: "x" } as never] });
    expect(out.ok).toBe(false);
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/engines/jsonb.spec.ts`
Expected: FAIL(`jsonbEngine` 不存在)。

- [ ] **Step 4: 實作**

`apps/web/src/lib/tools/query-builder/engines/jsonb.ts`:
```ts
import { buildJsonbQuery, type JsonbFilterGroup } from "@rfjs/jsonb-query";

import type { FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const STRING_OPS = [
  "eq", "neq", "contains", "icontains", "startswith", "istartswith",
  "endswith", "iendswith", "ieq", "ineq", "terms", ...NULL_OPS,
];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", "contains", "haskey", "hasanykey", "hasallkeys", ...NULL_OPS];
const ARRAY_EMPTY_OPS = ["isempty", "isnotempty"];

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return ops.map((op) => ({ op, arity: arityOf(op) }));
}

export const jsonbEngine: Engine = {
  id: "jsonb",
  label: "jsonb-query (PostgreSQL)",
  operators(dataType, elementType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") {
      if (elementType === "object") return toSpecs(["elemmatch"]);
      const base = elementType ? scalarOps(elementType) : STRING_OPS;
      return toSpecs([...base, "contains", "containsall", ...ARRAY_EMPTY_OPS]);
    }
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike) {
    try {
      const { where, values } = buildJsonbQuery("data", group as unknown as JsonbFilterGroup, {
        dialect: "legacy",
      });
      return { ok: true, primary: where, secondary: JSON.stringify(values, null, 2) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "queryFailed" };
    }
  },
};
```

> 註:`operators()` 的陣列可能含重複(例如 string 陣列 base 已含 `contains`)。下一步以測試確認對外行為,Task 6 registry 不去重亦無妨;若元件需要去重,在 Task 9 的 select 以 `Set` 處理。

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/engines/jsonb.spec.ts`
Expected: PASS(7 個測試)。若 string 陣列 base 重複 `contains` 造成斷言失敗,於 `operators()` 回傳前以 `[...new Set(ops)]` 去重後再轉 specs。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/engines/arity.ts apps/web/src/lib/tools/query-builder/engines/jsonb.ts apps/web/src/lib/tools/query-builder/engines/jsonb.spec.ts
git commit --no-verify -m "feat(web/query-builder): jsonb engine matrix + compile"
```

---

## Task 5: data-filter 引擎

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/engines/data-filter.ts`
- Test: `apps/web/src/lib/tools/query-builder/engines/data-filter.spec.ts`

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/engines/data-filter.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { treeToFilterGroup } from "../compile";
import type { BuilderGroup } from "../types";
import { dataFilterEngine, DATA_FILTER_OPS } from "./data-filter";

describe("dataFilterEngine.operators", () => {
  it("offers substring ops but NOT case-insensitive ops for string", () => {
    const ops = dataFilterEngine.operators("string").map((o) => o.op);
    expect(ops).toContain("contains");
    expect(ops).not.toContain("icontains"); // data-filter 沒有大小寫不敏感
  });

  it("offers comparison ops for numeric", () => {
    expect(dataFilterEngine.operators("numeric").map((o) => o.op)).toEqual(
      expect.arrayContaining(["gt", "gte", "lt", "lte", "range"]),
    );
  });

  it("object ops exclude the haskey family", () => {
    const ops = dataFilterEngine.operators("object").map((o) => o.op);
    expect(ops).not.toContain("haskey");
    expect(ops).toContain("contains");
  });

  it("array of objects -> elemmatch only", () => {
    expect(dataFilterEngine.operators("array", "object").map((o) => o.op)).toEqual(["elemmatch"]);
  });
});

describe("dataFilterEngine.compile", () => {
  it("emits the filter group as pretty JSON", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 18 }],
    };
    const out = dataFilterEngine.compile(treeToFilterGroup(tree));
    expect(out).toEqual({
      ok: true,
      primary: JSON.stringify({ logic: "and", filters: [{ field: "age", dataType: "numeric", operator: "gt", value: 18 }] }, null, 2),
    });
  });
});

describe("DATA_FILTER_OPS coverage set", () => {
  it("contains data-filter operators and excludes jsonb-only ones", () => {
    expect(DATA_FILTER_OPS.has("contains")).toBe(true);
    expect(DATA_FILTER_OPS.has("icontains")).toBe(false);
    expect(DATA_FILTER_OPS.has("haskey")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/engines/data-filter.spec.ts`
Expected: FAIL(`dataFilterEngine` 不存在)。

- [ ] **Step 3: 實作**

`apps/web/src/lib/tools/query-builder/engines/data-filter.ts`:
```ts
import type { FilterGroupLike } from "../compile";
import { arityOf } from "./arity";
import type { Engine, OperatorSpec } from "./types";

const NULL_OPS = ["isnull", "isnotnull"];
const STRING_OPS = ["eq", "neq", "contains", "startswith", "endswith", "terms", ...NULL_OPS];
const COMPARABLE_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "range", "terms", ...NULL_OPS];
const BOOLEAN_OPS = ["eq", "neq", ...NULL_OPS];
const OBJECT_OPS = ["eq", "neq", "contains", ...NULL_OPS];

function scalarOps(dataType: string): string[] {
  if (dataType === "string") return STRING_OPS;
  if (dataType === "boolean") return BOOLEAN_OPS;
  return COMPARABLE_OPS; // numeric / date
}

function arrayOps(elementType?: string): string[] {
  if (elementType === "object") return ["elemmatch"];
  if (elementType === "boolean") return ["eq", "containsall", ...NULL_OPS];
  if (elementType === "numeric" || elementType === "date") {
    return ["eq", "gt", "gte", "lt", "lte", "range", "terms", "containsall", ...NULL_OPS];
  }
  return ["eq", "contains", "startswith", "endswith", "terms", "containsall", ...NULL_OPS]; // string
}

function toSpecs(ops: string[]): OperatorSpec[] {
  return [...new Set(ops)].map((op) => ({ op, arity: arityOf(op) }));
}

// 即時比對覆蓋率用：所有 data-filter 能 evaluate 的 operator。
export const DATA_FILTER_OPS = new Set<string>([
  ...STRING_OPS, ...COMPARABLE_OPS, ...BOOLEAN_OPS, ...OBJECT_OPS,
  "contains", "startswith", "endswith", "containsall", "elemmatch",
]);

export const dataFilterEngine: Engine = {
  id: "data-filter",
  label: "data-filter (in-memory)",
  operators(dataType, elementType) {
    if (dataType === "object") return toSpecs(OBJECT_OPS);
    if (dataType === "array") return toSpecs(arrayOps(elementType));
    return toSpecs(scalarOps(dataType));
  },
  compile(group: FilterGroupLike) {
    return { ok: true, primary: JSON.stringify(group, null, 2) };
  },
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/engines/data-filter.spec.ts`
Expected: PASS(6 個測試)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/engines/data-filter.ts apps/web/src/lib/tools/query-builder/engines/data-filter.spec.ts
git commit --no-verify -m "feat(web/query-builder): data-filter engine matrix + compile"
```

---

## Task 6: 引擎 registry

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/engines/index.ts`
- Test: `apps/web/src/lib/tools/query-builder/engines/index.spec.ts`

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/engines/index.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { ENGINE_IDS, getEngine } from "./index";

describe("engine registry", () => {
  it("lists both engine ids, jsonb first", () => {
    expect(ENGINE_IDS).toEqual(["jsonb", "data-filter"]);
  });

  it("resolves an engine by id", () => {
    expect(getEngine("jsonb").id).toBe("jsonb");
    expect(getEngine("data-filter").id).toBe("data-filter");
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/engines/index.spec.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**

`apps/web/src/lib/tools/query-builder/engines/index.ts`:
```ts
import { dataFilterEngine } from "./data-filter";
import { jsonbEngine } from "./jsonb";
import type { Engine, EngineId } from "./types";

// mongo 引擎的擴充點：未來新增 mongoEngine 並登記於此即可。
const ENGINES: Record<EngineId, Engine> = {
  jsonb: jsonbEngine,
  "data-filter": dataFilterEngine,
};

export const ENGINE_IDS: EngineId[] = ["jsonb", "data-filter"];

export function getEngine(id: EngineId): Engine {
  return ENGINES[id];
}

export type { Engine, EngineId, OperatorSpec, OperatorArity, EngineOutput } from "./types";
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/engines/index.spec.ts`
Expected: PASS(2 個測試)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/engines/index.ts apps/web/src/lib/tools/query-builder/engines/index.spec.ts
git commit --no-verify -m "feat(web/query-builder): engine registry"
```

---

## Task 7: 即時比對

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/live-match.ts`
- Test: `apps/web/src/lib/tools/query-builder/live-match.spec.ts`

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/live-match.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { runLiveMatch } from "./live-match";
import type { BuilderGroup } from "./types";

const rows = [{ age: 30 }, { age: 10 }, { age: 40 }];

const adults: BuilderGroup = {
  kind: "group", id: "g", logic: "and",
  children: [{ kind: "condition", id: "c", field: "age", dataType: "numeric", operator: "gt", value: 18 }],
};

describe("runLiveMatch", () => {
  it("returns rows matching the tree with a count", () => {
    const r = runLiveMatch(rows, adults);
    expect(r.uncoverable).toBe(false);
    expect(r.count).toBe(2);
    expect(r.matched).toEqual([{ age: 30 }, { age: 40 }]);
  });

  it("flags uncoverable when a jsonb-only operator is present", () => {
    const tree: BuilderGroup = {
      kind: "group", id: "g", logic: "and",
      children: [{ kind: "condition", id: "c", field: "name", dataType: "string", operator: "icontains", value: "x" }],
    };
    const r = runLiveMatch([{ name: "X" }], tree);
    expect(r.uncoverable).toBe(true);
  });

  it("empty group matches everything (identity)", () => {
    const empty: BuilderGroup = { kind: "group", id: "g", logic: "and", children: [] };
    expect(runLiveMatch(rows, empty).count).toBe(3);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/live-match.spec.ts`
Expected: FAIL(`runLiveMatch` 不存在)。

- [ ] **Step 3: 實作**

`apps/web/src/lib/tools/query-builder/live-match.ts`:
```ts
import { matchQuery, type FilterMatchQuery } from "@rfjs/data-filter";

import { treeToFilterGroup, type FilterConditionLike, type FilterGroupLike } from "./compile";
import { DATA_FILTER_OPS } from "./engines/data-filter";
import type { BuilderGroup } from "./types";

export interface LiveMatchResult {
  matched: unknown[];
  count: number;
  uncoverable: boolean;
}

function hasUncoverableOp(group: FilterGroupLike): boolean {
  return group.filters.some((f) => {
    if ("logic" in f) return hasUncoverableOp(f);
    const c = f as FilterConditionLike;
    if (c.operator === "elemmatch" && c.filters) return hasUncoverableOp(c.filters);
    return !DATA_FILTER_OPS.has(c.operator);
  });
}

export function runLiveMatch(rows: unknown[], tree: BuilderGroup): LiveMatchResult {
  const group = treeToFilterGroup(tree);
  const uncoverable = hasUncoverableOp(group);
  if (uncoverable) return { matched: [], count: 0, uncoverable: true };
  try {
    const matched = rows.filter((row) => matchQuery(row, group as unknown as FilterMatchQuery));
    return { matched, count: matched.length, uncoverable: false };
  } catch {
    return { matched: [], count: 0, uncoverable: true };
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/live-match.spec.ts`
Expected: PASS(3 個測試)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/live-match.ts apps/web/src/lib/tools/query-builder/live-match.spec.ts
git commit --no-verify -m "feat(web/query-builder): in-memory live match with coverage flag"
```

---

## Task 8: 純樹變更操作

**Files:**
- Create: `apps/web/src/lib/tools/query-builder/tree-ops.ts`
- Test: `apps/web/src/lib/tools/query-builder/tree-ops.spec.ts`

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/lib/tools/query-builder/tree-ops.spec.ts`:
```ts
import { describe, expect, it } from "vitest";

import { addCondition, addGroup, emptyGroup, removeNode, setLogic, updateNode } from "./tree-ops";
import type { BuilderCondition, BuilderGroup } from "./types";

let counter = 0;
const id = () => `id-${counter++}`;

describe("tree-ops", () => {
  it("emptyGroup creates an and-group with no children", () => {
    const g = emptyGroup(id);
    expect(g.kind).toBe("group");
    expect(g.logic).toBe("and");
    expect(g.children).toEqual([]);
  });

  it("addCondition appends a blank condition to the target group", () => {
    const root = emptyGroup(id);
    const next = addCondition(root, root.id, id);
    expect(next.children).toHaveLength(1);
    expect((next.children[0] as BuilderCondition).kind).toBe("condition");
  });

  it("addGroup appends a nested group", () => {
    const root = emptyGroup(id);
    const next = addGroup(root, root.id, id);
    expect((next.children[0] as BuilderGroup).kind).toBe("group");
  });

  it("addCondition targets a nested group by id", () => {
    const root = addGroup(emptyGroup(id), undefined as never, id); // see note
    const nested = root.children[0] as BuilderGroup;
    const next = addCondition(root, nested.id, id);
    expect((next.children[0] as BuilderGroup).children).toHaveLength(1);
  });

  it("setLogic changes a group's logic immutably", () => {
    const root = emptyGroup(id);
    const next = setLogic(root, root.id, "or");
    expect(next.logic).toBe("or");
    expect(root.logic).toBe("and"); // 原物件未被改動
  });

  it("updateNode patches a condition by id", () => {
    let root = emptyGroup(id);
    root = addCondition(root, root.id, id);
    const cid = (root.children[0] as BuilderCondition).id;
    const next = updateNode(root, cid, { field: "age", dataType: "numeric", operator: "gt", value: 18 });
    expect(root.children[0]).not.toBe(next.children[0]); // 不可變
    expect((next.children[0] as BuilderCondition).field).toBe("age");
  });

  it("removeNode deletes a child by id", () => {
    let root = emptyGroup(id);
    root = addCondition(root, root.id, id);
    const cid = (root.children[0] as BuilderCondition).id;
    expect(removeNode(root, cid).children).toHaveLength(0);
  });
});
```

> 註:`addGroup` 第二參數為「目標群組 id」;對 root 操作時傳入 `root.id`。上面第 4 個測試示意巢狀,實作時請改成先 `addGroup(root, root.id, id)`。

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/tree-ops.spec.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 修正第 4 個測試的目標 id 後實作**

先把測試裡的
`const root = addGroup(emptyGroup(id), undefined as never, id);`
改成:
```ts
const base = emptyGroup(id);
const root = addGroup(base, base.id, id);
```

`apps/web/src/lib/tools/query-builder/tree-ops.ts`:
```ts
import type { BuilderCondition, BuilderGroup, BuilderItem, LogicOp } from "./types";

type IdGen = () => string;

export function emptyGroup(id: IdGen): BuilderGroup {
  return { kind: "group", id: id(), logic: "and", children: [] };
}

function blankCondition(id: IdGen): BuilderCondition {
  return { kind: "condition", id: id(), field: "", dataType: "string", operator: "", value: "" };
}

// 在符合 targetId 的群組底下加入一個子節點（immutable）。
function appendTo(group: BuilderGroup, targetId: string, child: BuilderItem): BuilderGroup {
  if (group.id === targetId) return { ...group, children: [...group.children, child] };
  return {
    ...group,
    children: group.children.map((c) => (c.kind === "group" ? appendTo(c, targetId, child) : c)),
  };
}

export function addCondition(group: BuilderGroup, targetId: string, id: IdGen): BuilderGroup {
  return appendTo(group, targetId, blankCondition(id));
}

export function addGroup(group: BuilderGroup, targetId: string, id: IdGen): BuilderGroup {
  return appendTo(group, targetId, emptyGroup(id));
}

export function setLogic(group: BuilderGroup, targetId: string, logic: LogicOp): BuilderGroup {
  if (group.id === targetId) return { ...group, logic };
  return {
    ...group,
    children: group.children.map((c) => (c.kind === "group" ? setLogic(c, targetId, logic) : c)),
  };
}

export function updateNode(
  group: BuilderGroup,
  targetId: string,
  patch: Partial<BuilderCondition>,
): BuilderGroup {
  return {
    ...group,
    children: group.children.map((c) => {
      if (c.kind === "group") return updateNode(c, targetId, patch);
      return c.id === targetId ? { ...c, ...patch } : c;
    }),
  };
}

export function removeNode(group: BuilderGroup, targetId: string): BuilderGroup {
  return {
    ...group,
    children: group.children
      .filter((c) => c.id !== targetId)
      .map((c) => (c.kind === "group" ? removeNode(c, targetId) : c)),
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest run src/lib/tools/query-builder/tree-ops.spec.ts`
Expected: PASS(7 個測試)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tools/query-builder/tree-ops.ts apps/web/src/lib/tools/query-builder/tree-ops.spec.ts
git commit --no-verify -m "feat(web/query-builder): immutable tree mutation helpers"
```

---

## Task 9: React 元件

所有邏輯已在純模組;元件為薄殼。本任務以 `check-types` + `lint` 驗證,Task 11 做手動 dev 驗證。元件需要的 `id()` 生成器用 `crypto.randomUUID()`(瀏覽器原生)。

**Files:**
- Create: `apps/web/src/components/tools/query-builder/value-editor.tsx`
- Create: `apps/web/src/components/tools/query-builder/builder-tree.tsx`
- Create: `apps/web/src/components/tools/query-builder/schema-panel.tsx`
- Create: `apps/web/src/components/tools/query-builder/preview-panel.tsx`
- Create: `apps/web/src/components/tools/query-builder/index.tsx`

- [ ] **Step 1: value-editor.tsx**

```tsx
"use client";

import type { OperatorArity } from "@/lib/tools/query-builder/engines/types";
import { coerceInput } from "@/lib/tools/query-builder/value-coerce";
import type { FieldType } from "@/lib/tools/query-builder/types";

function rawOf(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function ValueEditor({
  dataType,
  arity,
  value,
  onChange,
}: {
  dataType: FieldType;
  arity: OperatorArity;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  if (arity === "none") return null;
  const placeholder =
    arity === "two" ? "min, max" : arity === "list" ? "a, b, c" : dataType;
  return (
    <input
      aria-label="value"
      value={rawOf(value)}
      placeholder={placeholder}
      onChange={(e) => onChange(coerceInput(dataType, arity, e.target.value))}
      className="min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 font-mono text-sm"
    />
  );
}
```

- [ ] **Step 2: builder-tree.tsx（遞迴 GroupNode + ConditionRow）**

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { X } from "lucide-react";

import { getEngine, type EngineId } from "@/lib/tools/query-builder/engines";
import { addCondition, addGroup, removeNode, setLogic, updateNode } from "@/lib/tools/query-builder/tree-ops";
import type { BuilderCondition, BuilderGroup, FieldSchema, LogicOp } from "@/lib/tools/query-builder/types";

import { ValueEditor } from "./value-editor";

const LOGIC_LABELS: Record<LogicOp, string> = {
  and: "全部成立 / All",
  or: "擇一成立 / Any",
  nor: "皆不成立 / None",
  not: "非全部 / Not all",
};

const id = () => crypto.randomUUID();

export function GroupNode({
  group,
  engineId,
  schema,
  onChange,
  onRemove,
  depth = 0,
}: {
  group: BuilderGroup;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (next: BuilderGroup) => void;
  onRemove?: () => void;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "rounded-sm border border-border p-2" : ""}>
      <div className="mb-2 flex items-center gap-2">
        <select
          aria-label="logic"
          value={group.logic}
          onChange={(e) => onChange(setLogic(group, group.id, e.target.value as LogicOp))}
          className="rounded-sm border bg-transparent px-2 py-1 text-sm"
        >
          {(Object.keys(LOGIC_LABELS) as LogicOp[]).map((l) => (
            <option key={l} value={l}>{LOGIC_LABELS[l]}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onChange(addCondition(group, group.id, id))}>
          + 條件
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange(addGroup(group, group.id, id))}>
          + 群組
        </Button>
        {onRemove ? (
          <Button size="sm" variant="ghost" aria-label="remove group" onClick={onRemove}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 pl-3">
        {group.children.map((child) =>
          child.kind === "group" ? (
            <GroupNode
              key={child.id}
              group={child}
              engineId={engineId}
              schema={schema}
              depth={depth + 1}
              onChange={(nextChild) =>
                onChange({ ...group, children: group.children.map((c) => (c.id === child.id ? nextChild : c)) })
              }
              onRemove={() => onChange(removeNode(group, child.id))}
            />
          ) : (
            <ConditionRow
              key={child.id}
              condition={child}
              engineId={engineId}
              schema={schema}
              onChange={(patch) => onChange(updateNode(group, child.id, patch))}
              onRemove={() => onChange(removeNode(group, child.id))}
            />
          ),
        )}
      </div>
    </div>
  );
}

function ConditionRow({
  condition,
  engineId,
  schema,
  onChange,
  onRemove,
}: {
  condition: BuilderCondition;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (patch: Partial<BuilderCondition>) => void;
  onRemove: () => void;
}) {
  const fields = schema.filter((f) => f.include);
  const engine = getEngine(engineId);
  const ops = engine.operators(condition.dataType, condition.elementType);
  const arity = ops.find((o) => o.op === condition.operator)?.arity ?? "one";

  function onField(path: string) {
    const f = schema.find((s) => s.path === path);
    if (!f) return;
    const nextOps = engine.operators(f.dataType, f.elementType);
    onChange({
      field: f.path,
      dataType: f.dataType,
      elementType: f.elementType,
      operator: nextOps[0]?.op ?? "",
      value: "",
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="field"
        value={condition.field}
        onChange={(e) => onField(e.target.value)}
        className="rounded-sm border bg-transparent px-2 py-1 text-sm"
      >
        <option value="">—</option>
        {fields.map((f) => (
          <option key={f.path} value={f.path}>{f.path}</option>
        ))}
      </select>
      <select
        aria-label="operator"
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value, value: "" })}
        className="rounded-sm border bg-transparent px-2 py-1 font-mono text-sm"
      >
        {ops.map((o) => (
          <option key={o.op} value={o.op}>{o.op}</option>
        ))}
      </select>
      {condition.operator === "elemmatch" ? (
        <span className="text-xs text-muted-foreground">elemmatch（巢狀比對,本切片暫以單層條件呈現）</span>
      ) : (
        <ValueEditor
          dataType={condition.dataType}
          arity={arity}
          value={condition.value}
          onChange={(v) => onChange({ value: v })}
        />
      )}
      <Button size="sm" variant="ghost" aria-label="remove condition" onClick={onRemove}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
```

> 註:elemmatch 的「巢狀子 builder」UI 留待後續加強;本切片在條件列顯示提示即可,canonical 樹與引擎已支援 `filters`,不影響 jsonb 編譯(無 filters 時該條會被 compile 丟棄為未完成→不會誤產 SQL)。若要在本切片就支援,於 ConditionRow 內以 `condition.filters` 遞迴一個 `GroupNode` 並透過 `onChange({ filters })` 更新。

- [ ] **Step 3: schema-panel.tsx**

```tsx
"use client";

import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";

import type { FieldSchema, FieldType } from "@/lib/tools/query-builder/types";

const TYPES: FieldType[] = ["string", "numeric", "date", "boolean", "object", "array"];

export function SchemaPanel({
  sampleText,
  schema,
  error,
  onSampleChange,
  onSchemaChange,
}: {
  sampleText: string;
  schema: FieldSchema[];
  error: string | null;
  onSampleChange: (text: string) => void;
  onSchemaChange: (next: FieldSchema[]) => void;
}) {
  const t = useTranslations("ToolUI");

  function patch(path: string, p: Partial<FieldSchema>) {
    onSchemaChange(schema.map((f) => (f.path === path ? { ...f, ...p } : f)));
  }

  return (
    <Panel title={t("data")}>
      <div className="flex flex-col gap-3">
        <textarea
          aria-label={t("data")}
          value={sampleText}
          onChange={(e) => onSampleChange(e.target.value)}
          spellCheck={false}
          rows={6}
          className="w-full resize-y rounded-sm border bg-transparent p-2 font-mono text-sm"
        />
        {error ? <p className="font-mono text-sm text-fault">{t(`error.${error}`)}</p> : null}
        <div className="flex flex-col gap-1">
          {schema.map((f) => (
            <div key={f.path} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={`include ${f.path}`}
                checked={f.include}
                onChange={(e) => patch(f.path, { include: e.target.checked })}
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{f.path}</span>
              <select
                aria-label={`type ${f.path}`}
                value={f.dataType}
                onChange={(e) => patch(f.path, { dataType: e.target.value as FieldType })}
                className="rounded-sm border bg-transparent px-1 py-0.5 text-xs"
              >
                {TYPES.map((tp) => (
                  <option key={tp} value={tp}>{tp}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 4: preview-panel.tsx**

```tsx
"use client";

import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useTranslations } from "next-intl";

import type { EngineOutput } from "@/lib/tools/query-builder/engines";
import type { LiveMatchResult } from "@/lib/tools/query-builder/live-match";

export function PreviewPanel({
  output,
  live,
}: {
  output: EngineOutput;
  live: LiveMatchResult;
}) {
  const t = useTranslations("ToolUI");
  return (
    <Panel
      title={t("output")}
      action={output.ok ? <CopyButton text={output.primary} label={t("copy")} /> : null}
    >
      <div className="flex flex-col gap-3">
        {output.ok ? (
          <>
            <pre className="overflow-x-auto font-mono text-sm text-signal">{output.primary}</pre>
            {output.secondary ? (
              <pre className="overflow-x-auto font-mono text-xs text-muted-foreground">{output.secondary}</pre>
            ) : null}
          </>
        ) : (
          <p className="font-mono text-sm text-fault">{output.error}</p>
        )}
        <div className="border-t border-border pt-2">
          {live.uncoverable ? (
            <p className="font-mono text-xs text-muted-foreground">{t("notPreviewable")}</p>
          ) : (
            <>
              <p className="mb-1 font-mono text-xs text-muted-foreground">{t("matched", { count: live.count })}</p>
              <pre className="max-h-48 overflow-auto font-mono text-xs text-muted-foreground">
                {JSON.stringify(live.matched, null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}
```

- [ ] **Step 5: index.tsx（state 中樞）**

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Panel } from "@rfjs/web-ui/components/panel";
import { useMemo, useState } from "react";

import { treeToFilterGroup } from "@/lib/tools/query-builder/compile";
import { ENGINE_IDS, getEngine, type EngineId } from "@/lib/tools/query-builder/engines";
import { runLiveMatch } from "@/lib/tools/query-builder/live-match";
import { inferSchema } from "@/lib/tools/query-builder/schema-infer";
import { emptyGroup } from "@/lib/tools/query-builder/tree-ops";
import type { BuilderGroup, FieldSchema } from "@/lib/tools/query-builder/types";

import { ToolShell } from "../tool-shell";
import { GroupNode } from "./builder-tree";
import { PreviewPanel } from "./preview-panel";
import { SchemaPanel } from "./schema-panel";

const SAMPLE = JSON.stringify(
  [
    { name: "Ada", age: 36, active: true, tags: ["ml", "math"] },
    { name: "Bo", age: 12, active: false, tags: ["games"] },
  ],
  null,
  2,
);

const id = () => crypto.randomUUID();

export function QueryBuilder() {
  const [sampleText, setSampleText] = useState(SAMPLE);
  const [schema, setSchema] = useState<FieldSchema[]>(() => safeInfer(SAMPLE).schema);
  const [error, setError] = useState<string | null>(() => safeInfer(SAMPLE).error);
  const [engineId, setEngineId] = useState<EngineId>("jsonb");
  const [tree, setTree] = useState<BuilderGroup>(() => emptyGroup(id));

  function onSample(text: string) {
    setSampleText(text);
    const { schema: next, error: err } = safeInfer(text);
    setError(err);
    if (!err) setSchema(next);
  }

  const rows = useMemo(() => parseRows(sampleText), [sampleText]);
  const output = useMemo(() => getEngine(engineId).compile(treeToFilterGroup(tree)), [engineId, tree]);
  const live = useMemo(() => runLiveMatch(rows, tree), [rows, tree]);

  return (
    <ToolShell
      operation="buildJsonbQuery() · matchQuery()"
      input={
        <div className="flex flex-col gap-3">
          <SchemaPanel
            sampleText={sampleText}
            schema={schema}
            error={error}
            onSampleChange={onSample}
            onSchemaChange={setSchema}
          />
          <Panel title="Builder">
            <div className="mb-3 flex gap-2">
              {ENGINE_IDS.map((eid) => (
                <Button
                  key={eid}
                  size="sm"
                  variant={eid === engineId ? "default" : "outline"}
                  onClick={() => setEngineId(eid)}
                >
                  {getEngine(eid).label}
                </Button>
              ))}
            </div>
            <GroupNode group={tree} engineId={engineId} schema={schema} onChange={setTree} />
          </Panel>
        </div>
      }
      output={<PreviewPanel output={output} live={live} />}
    />
  );
}

function parseRows(text: string): unknown[] {
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function safeInfer(text: string): { schema: FieldSchema[]; error: string | null } {
  try {
    return { schema: inferSchema(JSON.parse(text)), error: null };
  } catch {
    return { schema: [], error: "invalidJson" };
  }
}
```

- [ ] **Step 6: 型別與 lint 檢查**

Run:
```bash
pnpm -F web check-types && pnpm -F web lint
```
Expected: 0 error、0 warning。若 `@rfjs/web-ui` 的 `Button` variant 名稱不同(例如非 `default`/`outline`/`ghost`),依該套件實際 variant 調整。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/tools/query-builder
git commit --no-verify -m "feat(web/query-builder): builder UI components"
```

---

## Task 10: 註冊工具 + metadata + i18n

**Files:**
- Modify: `apps/web/src/components/tools/registry.tsx`
- Modify: `packages/web-core/src/registry/tools.ts`
- Modify: `apps/web/src/messages/en.json`
- Modify: `apps/web/src/messages/zh-TW.json`

- [ ] **Step 1: 註冊元件**

`apps/web/src/components/tools/registry.tsx` — import 並加入 map:
```tsx
import { QueryBuilder } from "./query-builder";
```
在 `TOOL_COMPONENTS` 物件加入:
```tsx
  "query-builder": QueryBuilder,
```

- [ ] **Step 2: web-core registry 新增工具**

`packages/web-core/src/registry/tools.ts` — 於陣列加入(放在 `jsonb-query-generator` 之後):
```ts
  {
    id: 'query-builder',
    category: 'query',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/jsonb-query', '@rfjs/data-filter'],
    tags: ['builder', 'jsonb', 'sql', 'nested'],
  },
```

- [ ] **Step 3: i18n — en.json**

`apps/web/src/messages/en.json` —
在 `Tools` 物件加入:
```json
    "query-builder": {
      "title": "Query Builder",
      "description": "Build nested JSONB queries visually and preview live matches."
    }
```
在 `ToolUI` 物件加入(若不存在):
```json
    "notPreviewable": "This operator can't be previewed in the browser"
```

- [ ] **Step 4: i18n — zh-TW.json**

`apps/web/src/messages/zh-TW.json` —
在 `Tools` 物件加入:
```json
    "query-builder": {
      "title": "查詢建構器",
      "description": "視覺化建構巢狀 JSONB 查詢,並即時預覽命中結果。"
    }
```
在 `ToolUI` 物件加入:
```json
    "notPreviewable": "此 operator 無法在瀏覽器預覽"
```

- [ ] **Step 5: 驗證 registry schema 與型別**

Run:
```bash
pnpm -F @rfjs/web-core test && pnpm -F web check-types
```
Expected: web-core 既有 registry 測試通過(新項目符合 `toolDefinitionSchema`);web 型別通過。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tools/registry.tsx packages/web-core/src/registry/tools.ts apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json
git commit --no-verify -m "feat(web/query-builder): register tool, metadata, and i18n"
```

---

## Task 11: 全面驗證與收尾

**Files:** 無(驗證)

- [ ] **Step 1: 全套單元測試**

Run: `pnpm -F web test`
Expected: 全綠(含本計畫新增的 schema-infer / compile / value-coerce / jsonb / data-filter / index / live-match / tree-ops 共 8 個 spec)。

- [ ] **Step 2: 型別 + lint**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F @rfjs/web-core test`
Expected: 全部通過。

- [ ] **Step 3: 手動 dev 驗證**

Run: `pnpm -F web dev`
開啟 `http://localhost:3000/en/tools/query-builder`,確認:
- 預設範例自動推斷出 name/age/active/tags 欄位且型別正確。
- 加條件 `age gt 18` → 右側出現 jsonb SQL `WHERE` 與命中 1 筆(Ada)。
- 切換引擎到 data-filter → 主輸出變成 filter group JSON;命中不變。
- 引擎=jsonb 時對 string 欄位選 `icontains` → 命中面板顯示「無法在瀏覽器預覽」,SQL 仍出。
- 加巢狀群組、改 logic 為「擇一成立 / Any」運作正常。

- [ ] **Step 4: 建置確認(SSG 不爆)**

Run: `pnpm -F web build`
Expected: build 成功(新工具的 `generateStaticParams` 會產生 `/tools/query-builder` 靜態頁)。

- [ ] **Step 5: changeset(若需發佈 web-core 變更)**

`apps/web` 為私有 app,通常不需 changeset;`@rfjs/web-core` 亦為 private(`surface` 僅供內部)。確認其 `package.json` 為 `"private": true`;若是則跳過 changeset。

- [ ] **Step 6: 最終 commit(若有未提交的微調)**

```bash
git add -A
git commit --no-verify -m "test(web/query-builder): full verification pass" || echo "nothing to commit"
```

---

## 自我檢查(撰寫後對照 spec)

- **spec 覆蓋:** schema 推斷(Task 1)、canonical tree + per-engine 矩陣(Task 1/4/5)、引擎 registry(Task 6)、即時命中含覆蓋率降級(Task 7)、三欄 UI 與遞迴樹(Task 9)、新工具 + i18n(Task 10)、SQL+命中雙預覽(Task 9/11)。延後項目(mongo / schema 持久化 / capability 自訂 / 真資料集)維持 out-of-scope。
- **type 一致性:** `BuilderGroup`/`BuilderCondition`/`FieldSchema`(Task 1)、`FilterGroupLike`(Task 2)、`OperatorSpec`/`Engine`/`EngineOutput`/`EngineId`/`OperatorArity`(Task 3 types + Task 6 re-export)、`coerceInput`/`arityOf`/`treeToFilterGroup`/`runLiveMatch`/`getEngine`/`ENGINE_IDS`/`emptyGroup`/`addCondition`/`addGroup`/`setLogic`/`updateNode`/`removeNode` 命名跨任務一致。
- **無 placeholder:** 每個程式步驟皆附完整程式碼與預期輸出。
- **已知微調點(實作時可能需要):** ① jsonb string-array operators 去重;② `@rfjs/web-ui` Button variant 實際名稱;③ tree-ops 測試第 4 例的目標 id(Step 3 已說明先 `addGroup(base, base.id, id)`)。
