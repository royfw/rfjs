# @rfjs/decision-table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增可發佈套件 `@rfjs/decision-table`(決策表 schema + `evaluateTable` 執行引擎,組合 filter-builder / data-expr)與 apps/web 展示 tool `decision-table`(表格編輯 + 單筆/批次試算)。

**Architecture:** edit↔execute 分層 —— `packages/decision-table` 是純邏輯執行層(zod schema、規則列 `when` 原樣內嵌 filter-builder 的 `BuilderGroup`、輸出常值或 `"="` 前綴 data-expr 表達式、`first`/`collect` hit policy、`uncoverable`/表達式錯誤絕不靜默);`apps/web/src/tools/decision-table/` 是展示層(每列條件用 `FilterTreeEditor` 在寬 sheet 內編輯、單筆與批次試算、JSON 匯入匯出)。

**Tech Stack:** TypeScript、zod ^4、`@rfjs/filter-builder`(`runLiveMatch`/`BuilderGroup`/`FieldSchema`/`emptyGroup`)、`@rfjs/data-expr`(`evaluate`/`isExpression`/`stripExpressionPrefix`)、tsdown(dist 建置,比照 filter-builder)、Vitest、React 19 + `@rfjs/filter-builder-ui` + `@rfjs/web-ui`(tool)、Playwright(e2e,既有基礎設施)。

## Global Constraints

- 全程在 worktree `.claude/worktrees/feat-decision-table` 內(由 `origin/main` ad849f2 建立;已 `pnpm install` + `pnpm build:packages`)。`<worktree>` = `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-decision-table`。
- 套件 `@rfjs/decision-table`:**可發佈**(非 private),`main/module/types` 指 `dist/`,tsdown 建置,`publishConfig.access: public` —— 一切比照 `packages/filter-builder`。
- 依賴:`@rfjs/filter-builder` + `@rfjs/data-expr`(workspace:*)+ `zod ^4.0.0`。**不依賴** React / web-ui(純邏輯)。
- hit policy 只做 `"first" | "collect"`;輸出值:常值 + 字串 `"="` 前綴走 data-expr;`defaultOutputs` 可選。
- **錯誤語意(spec §4)**:條件樹 `uncoverable`(data-filter 無法在記憶體評估)→ 該列跳過 + 記入 `ruleErrors`;表達式運算失敗 → 該輸出鍵 `undefined` + 記入 `ruleErrors`;`opts.strict: true` 時**立即 throw** `DecisionTableError`。絕不靜默。
- `evaluateTable` 為 **async**;data-expr 的 `CompiledExpr` **不可併發呼叫**(套件契約)→ 輸出解析一律**循序 await**(不用 `Promise.all`)。
- **spec 歧義裁定(collect 的輸出形狀)**:`first` → `Record | null`;`collect` → **永遠是陣列**(無命中 + default → 單元素陣列且 `usedDefault: true`;無命中無 default → `[]`)。
- 展示 tool:**不得 import `apps/web/src/tools/flow-builder/` 內任何檔案**(並行 session 正在改那個目錄)—— sheet 模式用「複製」不是「引用」。
- i18n:`ToolUI` 鍵以 **`dt` 前綴**;`Tools["decision-table"].{title,description}` + `Packages["decision-table"].description` en + zh-TW 齊備(`i18n-content.spec` 會強制)。
- **不動** `apps/web/next.config.js`(套件有 dist,毋需 transpile)。⚠️ 改套件後要 `pnpm -F @rfjs/decision-table build` 否則 app 看不到(repo 已知坑)。
- 檔名 kebab-case;co-locate `*.spec.ts(x)`。
- Commit:英文 conventional,**subject 全小寫開頭**(commitlint 拒 sentence-case),訊息最後一行 trailer 精確為:`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;body 與 trailer 之間留空行(commitlint footer-leading-blank)。
- 新套件**附 changeset**(minor);**HOLD PR**(全部完成後不開/不合 PR,等人工指示)。
- git 一律 `git -C <worktree> …`;pnpm 一律 `pnpm -C <worktree> …`(下文為精簡省略前綴,執行時帶上)。

---

## Task 1: 套件 scaffold + 型別 + zod schema(TDD)

**Files:**
- Create: `packages/decision-table/package.json`
- Create: `packages/decision-table/tsconfig.json`
- Create: `packages/decision-table/tsconfig.build.json`
- Create: `packages/decision-table/tsdown.config.ts`
- Create: `packages/decision-table/vitest.config.mts`
- Create: `packages/decision-table/eslint.config.js`
- Create: `packages/decision-table/src/types.ts`
- Create: `packages/decision-table/src/schema.ts`
- Create: `packages/decision-table/src/index.ts`(暫只 export types + schema)
- Test: `packages/decision-table/src/schema.spec.ts`

**Interfaces:**
- Produces:
  - `type HitPolicy = "first" | "collect"`
  - `interface DecisionOutputDef { key: string; label?: string }`
  - `interface DecisionRule { id: string; description?: string; when: BuilderGroup; outputs: Record<string, unknown> }`
  - `interface DecisionTable { version: 1; name?: string; inputs?: FieldSchema[]; outputs: DecisionOutputDef[]; hitPolicy: HitPolicy; rules: DecisionRule[]; defaultOutputs?: Record<string, unknown> }`
  - `decisionTableSchema: z.ZodType<DecisionTable>`、`parseTable(json: string): DecisionTable`、`tableToJson(t: DecisionTable): string`

- [ ] **Step 1: 建立套件設定檔**

`packages/decision-table/package.json`:

```json
{
  "name": "@rfjs/decision-table",
  "version": "0.0.0",
  "description": "DMN-style decision table over the @rfjs stack: rules are filter-builder condition trees, outputs are constants or data-expr \"=\" expressions, with first/collect hit policies",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "scripts": {
    "clean": "pnpm exec npm-run-all --parallel clean:dist clean:types",
    "clean:types": "pnpm exec rimraf ./types",
    "clean:dist": "pnpm exec rimraf ./dist",
    "build": "pnpm run build:tsdown",
    "build:tsdown": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "lint:fix": "eslint \"src/**/*.ts\" --fix",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "keywords": ["decision-table", "dmn", "rules", "routing", "filter"],
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": { "type": "git", "url": "git+https://github.com/royfw/rfjs.git", "directory": "packages/decision-table" },
  "bugs": "https://github.com/royfw/rfjs/issues",
  "homepage": "https://github.com/royfw/rfjs/tree/main/packages/decision-table#readme",
  "files": ["dist", "README.md"],
  "dependencies": {
    "@rfjs/data-expr": "workspace:*",
    "@rfjs/filter-builder": "workspace:*",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.5.1",
    "rimraf": "^6.0.1",
    "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  }
}
```

`packages/decision-table/tsconfig.json`(照抄 filter-builder):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "rootDir": "./src",
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "importHelpers": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "types",
    "emitDeclarationOnly": false,
    "outDir": "dist",
    "sourceMap": true,
    "paths": { "@/*": ["./src/*"] },
    "resolveJsonModule": true,
    "removeComments": true,
    "newLine": "lf",
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "lib": ["ESNext"]
  },
  "exclude": ["node_modules", "dist*", "test", "types", "**/*.spec.ts", "**/*.test.ts", "*.config.*"]
}
```

`packages/decision-table/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "test", "*.config.*"]
}
```

`packages/decision-table/tsdown.config.ts`:

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  tsconfig: 'tsconfig.build.json',
  target: 'es2023',
  platform: 'neutral',
  treeshake: true,
  sourcemap: true,
  clean: true,
  dts: true,
});
```

`packages/decision-table/vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.spec.(ts|js)'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

`packages/decision-table/eslint.config.js`(純 TS 套件,照 web-core 形):

```js
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
```

- [ ] **Step 2: 安裝 workspace 連結**

Run:
```bash
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-decision-table install
```
Expected: 成功,lockfile 新增 `packages/decision-table` importer。

- [ ] **Step 3: 寫型別 `packages/decision-table/src/types.ts`**

```ts
import type { BuilderGroup, FieldSchema } from '@rfjs/filter-builder';

export type HitPolicy = 'first' | 'collect';

export interface DecisionOutputDef {
  /** 輸出欄 key(outputs record 中的鍵)。 */
  key: string;
  label?: string;
}

export interface DecisionRule {
  id: string;
  description?: string;
  /** filter-builder 條件樹「原樣內嵌」(任意巢狀 and/or/nor/not + elemmatch)。 */
  when: BuilderGroup;
  /** 輸出值:常值直接用;字串以 "=" 前綴 → data-expr 對 context 運算。 */
  outputs: Record<string, unknown>;
}

export interface DecisionTable {
  version: 1;
  name?: string;
  /** 欄位定義(給編輯器用;沿用 filter-builder 的 FieldSchema)。 */
  inputs?: FieldSchema[];
  outputs: DecisionOutputDef[];
  hitPolicy: HitPolicy;
  /** 有序:由上而下評估。 */
  rules: DecisionRule[];
  /** 無命中時的 else 輸出(可選;值同樣支援 "=" 表達式)。 */
  defaultOutputs?: Record<string, unknown>;
}
```

- [ ] **Step 4: 寫失敗測試 `packages/decision-table/src/schema.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { decisionTableSchema, parseTable, tableToJson } from './schema';
import type { DecisionTable } from './types';

const WHEN = { kind: 'group', id: 'g1', logic: 'and', children: [] } as const;

const VALID: DecisionTable = {
  version: 1,
  name: 'routing',
  outputs: [{ key: 'approver', label: 'Approver' }],
  hitPolicy: 'first',
  rules: [{ id: 'r1', when: { ...WHEN }, outputs: { approver: 'Manager' } }],
  defaultOutputs: { approver: 'Direct Manager' },
};

describe('decisionTableSchema', () => {
  it('accepts a valid table and round-trips through JSON', () => {
    expect(() => decisionTableSchema.parse(VALID)).not.toThrow();
    expect(parseTable(tableToJson(VALID))).toEqual(VALID);
  });

  it('rejects a bad version, bad hitPolicy, and missing outputs', () => {
    expect(() => decisionTableSchema.parse({ ...VALID, version: 2 })).toThrow();
    expect(() => decisionTableSchema.parse({ ...VALID, hitPolicy: 'unique' })).toThrow();
    expect(() => decisionTableSchema.parse({ ...VALID, outputs: undefined })).toThrow();
  });

  it('rejects a rule whose when is not a group shell', () => {
    const bad = { ...VALID, rules: [{ id: 'r1', when: { nope: true }, outputs: {} }] };
    expect(() => decisionTableSchema.parse(bad)).toThrow();
  });

  it('rejects duplicated rule ids', () => {
    const bad = {
      ...VALID,
      rules: [
        { id: 'dup', when: { ...WHEN }, outputs: {} },
        { id: 'dup', when: { ...WHEN, id: 'g2' }, outputs: {} },
      ],
    };
    expect(() => decisionTableSchema.parse(bad)).toThrow();
  });

  it('parseTable throws on invalid JSON text', () => {
    expect(() => parseTable('not json')).toThrow();
    expect(() => parseTable('{"version":1}')).toThrow();
  });
});
```

- [ ] **Step 5: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/decision-table vitest:run`
Expected: FAIL —— 找不到 `./schema`。

- [ ] **Step 6: 實作 `packages/decision-table/src/schema.ts`**

> `when` 只做**結構性驗證**(group 殼:kind/id/logic/children;深度驗證交給編輯器/引擎)—— 用 `z.custom` 避免綁死 zod 版本細節,型別直接對 `BuilderGroup`。

```ts
import { z } from 'zod';
import type { BuilderGroup } from '@rfjs/filter-builder';

import type { DecisionTable } from './types';

const LOGIC_OPS = new Set(['and', 'or', 'nor', 'not']);

/** 結構性檢查:是否為 BuilderGroup 的殼(不深驗 children 內容)。 */
export function isGroupShell(v: unknown): v is BuilderGroup {
  if (typeof v !== 'object' || v === null) return false;
  const g = v as Record<string, unknown>;
  return (
    g.kind === 'group' &&
    typeof g.id === 'string' &&
    g.id.length > 0 &&
    typeof g.logic === 'string' &&
    LOGIC_OPS.has(g.logic) &&
    Array.isArray(g.children)
  );
}

const builderGroupSchema = z.custom<BuilderGroup>(isGroupShell, 'invalid builder group');

const outputDefSchema = z.object({
  key: z.string().min(1),
  label: z.string().optional(),
});

const ruleSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  when: builderGroupSchema,
  outputs: z.record(z.string(), z.unknown()),
});

export const decisionTableSchema: z.ZodType<DecisionTable> = z
  .object({
    version: z.literal(1),
    name: z.string().optional(),
    inputs: z.array(z.record(z.string(), z.unknown())).optional() as z.ZodType<DecisionTable['inputs']>,
    outputs: z.array(outputDefSchema).min(1),
    hitPolicy: z.enum(['first', 'collect']),
    rules: z.array(ruleSchema),
    defaultOutputs: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((t) => new Set(t.rules.map((r) => r.id)).size === t.rules.length, {
    message: 'duplicated rule id',
    path: ['rules'],
  }) as z.ZodType<DecisionTable>;

export function parseTable(json: string): DecisionTable {
  return decisionTableSchema.parse(JSON.parse(json));
}

export function tableToJson(table: DecisionTable): string {
  return JSON.stringify(table, null, 2);
}
```

`packages/decision-table/src/index.ts`:

```ts
export * from './types';
export * from './schema';
```

- [ ] **Step 7: 跑測試 + typecheck 確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/decision-table vitest:run && pnpm -C <worktree> --filter @rfjs/decision-table typecheck`
Expected: PASS(5 passed);typecheck 無錯誤(`inputs` 的 cast 若報錯,改為 `z.custom<DecisionTable['inputs']>((v) => v === undefined || Array.isArray(v)).optional()` 形式,維持結構性驗證的精神即可)。

- [ ] **Step 8: Commit**

```bash
git add packages/decision-table pnpm-lock.yaml
git commit -m "feat(decision-table): scaffold package with types and zod schema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: 編輯輔助純函式(TDD)

**Files:**
- Create: `packages/decision-table/src/edit-ops.ts`
- Test: `packages/decision-table/src/edit-ops.spec.ts`
- Modify: `packages/decision-table/src/index.ts`(加一行 export)

**Interfaces:**
- Consumes: `DecisionTable`, `DecisionRule` from `./types`;`emptyGroup` from `@rfjs/filter-builder`
- Produces:
  - `emptyTable(): DecisionTable`(version 1、outputs 一欄 `result`、hitPolicy first、rules 空)
  - `newRule(id: () => string): DecisionRule`(空 when 群組 + 空 outputs)
  - `moveRule(t: DecisionTable, from: number, to: number): DecisionTable`(immutable;越界 no-op)

- [ ] **Step 1: 寫失敗測試 `packages/decision-table/src/edit-ops.spec.ts`**

```ts
import { describe, expect, it } from 'vitest';

import { emptyTable, newRule, moveRule } from './edit-ops';
import { decisionTableSchema } from './schema';

let seq = 0;
const id = () => `id-${++seq}`;

describe('edit-ops', () => {
  it('emptyTable is schema-valid with one output column and no rules', () => {
    const t = emptyTable();
    expect(() => decisionTableSchema.parse(t)).not.toThrow();
    expect(t.rules).toEqual([]);
    expect(t.outputs.length).toBe(1);
    expect(t.hitPolicy).toBe('first');
  });

  it('newRule creates a rule with an empty and-group and unique ids', () => {
    const a = newRule(id);
    const b = newRule(id);
    expect(a.when.kind).toBe('group');
    expect(a.when.logic).toBe('and');
    expect(a.when.children).toEqual([]);
    expect(a.id).not.toBe(b.id);
    expect(a.outputs).toEqual({});
  });

  it('moveRule reorders immutably and no-ops when out of range', () => {
    const t = { ...emptyTable(), rules: [newRule(id), newRule(id), newRule(id)] };
    const ids = t.rules.map((r) => r.id);
    const moved = moveRule(t, 0, 2);
    expect(moved.rules.map((r) => r.id)).toEqual([ids[1], ids[2], ids[0]]);
    expect(t.rules.map((r) => r.id)).toEqual(ids); // 原物件不變
    expect(moveRule(t, -1, 0)).toBe(t);
    expect(moveRule(t, 0, 99)).toBe(t);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/decision-table vitest:run`
Expected: FAIL —— 找不到 `./edit-ops`。

- [ ] **Step 3: 實作 `packages/decision-table/src/edit-ops.ts`**

```ts
import { emptyGroup } from '@rfjs/filter-builder';

import type { DecisionRule, DecisionTable } from './types';

/** 全新空表:一個輸出欄、first、無規則。 */
export function emptyTable(): DecisionTable {
  return {
    version: 1,
    outputs: [{ key: 'result' }],
    hitPolicy: 'first',
    rules: [],
  };
}

/** 新規則:空的 and 群組 + 空輸出。 */
export function newRule(id: () => string): DecisionRule {
  return { id: id(), when: emptyGroup(id), outputs: {} };
}

/** 移動規則(immutable);索引越界時原樣返回。 */
export function moveRule(table: DecisionTable, from: number, to: number): DecisionTable {
  const n = table.rules.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return table;
  const rules = [...table.rules];
  const [moved] = rules.splice(from, 1);
  rules.splice(to, 0, moved!);
  return { ...table, rules };
}
```

`packages/decision-table/src/index.ts` 末尾加:

```ts
export * from './edit-ops';
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/decision-table vitest:run`
Expected: PASS(8 passed)。

- [ ] **Step 5: Commit**

```bash
git add packages/decision-table/src/edit-ops.ts packages/decision-table/src/edit-ops.spec.ts packages/decision-table/src/index.ts
git commit -m "feat(decision-table): add edit helpers (emptyTable, newRule, moveRule)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: `evaluateTable` 執行引擎(TDD,核心)

**Files:**
- Create: `packages/decision-table/src/evaluate.ts`
- Test: `packages/decision-table/src/evaluate.spec.ts`
- Modify: `packages/decision-table/src/index.ts`(加一行 export)

**Interfaces:**
- Consumes: `decisionTableSchema`(./schema)、types;`runLiveMatch` from `@rfjs/filter-builder`;`evaluate as evaluateExpr, isExpression, stripExpressionPrefix` from `@rfjs/data-expr`
- Produces:
  - `interface RuleError { ruleId: string; kind: "uncoverable" | "expression"; message: string }`
  - `class DecisionTableError extends Error { errors: RuleError[] }`
  - `interface EvaluateResult { hitPolicy: HitPolicy; matched: string[]; outputs: Record<string, unknown> | Record<string, unknown>[] | null; usedDefault: boolean; ruleErrors: RuleError[] }`
  - `async function evaluateTable(table: DecisionTable, context: unknown, opts?: { strict?: boolean }): Promise<EvaluateResult>`

- [ ] **Step 1: 寫失敗測試 `packages/decision-table/src/evaluate.spec.ts`**

> 條件樹直接手寫 BuilderGroup 字面值(kind/id/dataType/operator 依 filter-builder 型別)。`gt`/`eq` 是 data-filter 支援的運算子;`sql-only` 用一個不在 data-filter 矩陣裡的運算子字串(如 `"ilike"` 若不在,實作時以 `DATA_FILTER_OPS` 未含者為準 —— 測試裡用明顯不存在的 `"not-a-real-op"` 最穩)。

```ts
import { describe, expect, it } from 'vitest';

import { evaluateTable, DecisionTableError } from './evaluate';
import type { DecisionTable } from './types';
import type { BuilderGroup } from '@rfjs/filter-builder';

const cond = (id: string, field: string, operator: string, value: unknown, dataType = 'numeric'): BuilderGroup => ({
  kind: 'group',
  id: `g-${id}`,
  logic: 'and',
  children: [{ kind: 'condition', id: `c-${id}`, field, dataType: dataType as never, operator, value }],
});

const TABLE: DecisionTable = {
  version: 1,
  outputs: [{ key: 'approver' }, { key: 'note' }],
  hitPolicy: 'first',
  rules: [
    { id: 'big', when: cond('big', 'amount', 'gt', 100000), outputs: { approver: 'CFO' } },
    { id: 'eng', when: {
        kind: 'group', id: 'g-eng', logic: 'and',
        children: [
          { kind: 'condition', id: 'c-a', field: 'amount', dataType: 'numeric', operator: 'gt', value: 50000 },
          { kind: 'condition', id: 'c-d', field: 'dept', dataType: 'string', operator: 'eq', value: 'Engineering' },
        ],
      }, outputs: { approver: 'VP Engineering', note: '= "routed for " & dept' } },
  ],
  defaultOutputs: { approver: 'Direct Manager' },
};

describe('evaluateTable — hit policies', () => {
  it('first: takes the first matching rule only', async () => {
    const r = await evaluateTable(TABLE, { amount: 200000, dept: 'Engineering' });
    expect(r.matched).toEqual(['big']);
    expect(r.outputs).toEqual({ approver: 'CFO' });
    expect(r.usedDefault).toBe(false);
    expect(r.ruleErrors).toEqual([]);
  });

  it('collect: gathers every matching rule in order (array)', async () => {
    const t: DecisionTable = { ...TABLE, hitPolicy: 'collect' };
    const r = await evaluateTable(t, { amount: 200000, dept: 'Engineering' });
    expect(r.matched).toEqual(['big', 'eng']);
    expect(Array.isArray(r.outputs)).toBe(true);
    expect((r.outputs as Record<string, unknown>[])[0]).toEqual({ approver: 'CFO' });
  });

  it('no match + defaultOutputs → usedDefault (first: record; collect: single-element array)', async () => {
    const rFirst = await evaluateTable(TABLE, { amount: 10, dept: 'HR' });
    expect(rFirst.matched).toEqual([]);
    expect(rFirst.usedDefault).toBe(true);
    expect(rFirst.outputs).toEqual({ approver: 'Direct Manager' });

    const rCollect = await evaluateTable({ ...TABLE, hitPolicy: 'collect' }, { amount: 10, dept: 'HR' });
    expect(rCollect.usedDefault).toBe(true);
    expect(rCollect.outputs).toEqual([{ approver: 'Direct Manager' }]);
  });

  it('no match + no default → first: null; collect: []', async () => {
    const noDefault: DecisionTable = { ...TABLE, defaultOutputs: undefined };
    expect((await evaluateTable(noDefault, { amount: 1 })).outputs).toBeNull();
    expect((await evaluateTable({ ...noDefault, hitPolicy: 'collect' }, { amount: 1 })).outputs).toEqual([]);
  });
});

describe('evaluateTable — "=" expressions', () => {
  it('resolves expression outputs against the context (nested paths work)', async () => {
    const r = await evaluateTable(TABLE, { amount: 60000, dept: 'Engineering' });
    expect(r.matched).toEqual(['eng']);
    expect(r.outputs).toEqual({ approver: 'VP Engineering', note: 'routed for Engineering' });
  });

  it('expression failure → key undefined + ruleErrors (non-strict), throws in strict', async () => {
    const bad: DecisionTable = {
      ...TABLE,
      rules: [{ id: 'r1', when: cond('r1', 'amount', 'gt', 0), outputs: { approver: '= $notAFunction(' } }],
    };
    const r = await evaluateTable(bad, { amount: 5 });
    expect(r.matched).toEqual(['r1']);
    expect((r.outputs as Record<string, unknown>).approver).toBeUndefined();
    expect(r.ruleErrors).toHaveLength(1);
    expect(r.ruleErrors[0]).toMatchObject({ ruleId: 'r1', kind: 'expression' });

    await expect(evaluateTable(bad, { amount: 5 }, { strict: true })).rejects.toBeInstanceOf(DecisionTableError);
  });
});

describe('evaluateTable — uncoverable rules', () => {
  const uncoverable: DecisionTable = {
    ...TABLE,
    defaultOutputs: undefined,
    rules: [
      { id: 'u1', when: cond('u1', 'amount', 'not-a-real-op', 1), outputs: { approver: 'X' } },
      { id: 'ok', when: cond('ok', 'amount', 'gt', 0), outputs: { approver: 'Manager' } },
    ],
  };

  it('skips the uncoverable rule, records ruleErrors, and still evaluates the rest', async () => {
    const r = await evaluateTable(uncoverable, { amount: 5 });
    expect(r.ruleErrors).toHaveLength(1);
    expect(r.ruleErrors[0]).toMatchObject({ ruleId: 'u1', kind: 'uncoverable' });
    expect(r.matched).toEqual(['ok']);
    expect(r.outputs).toEqual({ approver: 'Manager' });
  });

  it('strict → throws DecisionTableError immediately', async () => {
    await expect(evaluateTable(uncoverable, { amount: 5 }, { strict: true })).rejects.toBeInstanceOf(DecisionTableError);
  });
});

describe('evaluateTable — boundaries', () => {
  it('validates the table at the boundary (invalid table throws)', async () => {
    await expect(evaluateTable({ version: 2 } as never, {})).rejects.toThrow();
  });

  it('empty rules → default or null; elemmatch nesting matches array items', async () => {
    const empty: DecisionTable = { ...TABLE, rules: [], defaultOutputs: undefined };
    expect((await evaluateTable(empty, {})).outputs).toBeNull();

    const withElem: DecisionTable = {
      ...TABLE,
      defaultOutputs: undefined,
      rules: [{
        id: 'elem',
        when: {
          kind: 'group', id: 'g-e', logic: 'and',
          children: [{
            kind: 'condition', id: 'c-e', field: 'items', dataType: 'array', elementType: 'object',
            operator: 'elemmatch',
            filters: cond('inner', 'price', 'gt', 10000),
          }],
        },
        outputs: { approver: 'Procurement' },
      }],
    };
    const r = await evaluateTable(withElem, { items: [{ price: 5 }, { price: 20000 }] });
    expect(r.matched).toEqual(['elem']);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/decision-table vitest:run`
Expected: FAIL —— 找不到 `./evaluate`。

- [ ] **Step 3: 實作 `packages/decision-table/src/evaluate.ts`**

```ts
import { runLiveMatch } from '@rfjs/filter-builder';
import { evaluate as evaluateExpr, isExpression, stripExpressionPrefix } from '@rfjs/data-expr';

import { decisionTableSchema } from './schema';
import type { DecisionRule, DecisionTable, HitPolicy } from './types';

export interface RuleError {
  ruleId: string;
  kind: 'uncoverable' | 'expression';
  message: string;
}

export class DecisionTableError extends Error {
  constructor(public readonly errors: RuleError[]) {
    super(errors.map((e) => `[${e.kind}] rule "${e.ruleId}": ${e.message}`).join('; '));
    this.name = 'DecisionTableError';
  }
}

export interface EvaluateOptions {
  /** true 時任一 uncoverable / expression 錯誤立即 throw DecisionTableError。 */
  strict?: boolean;
}

export interface EvaluateResult {
  hitPolicy: HitPolicy;
  /** 命中的 ruleId(依表內順序;first 至多 1 個)。 */
  matched: string[];
  /** first → Record | null;collect → Record[](default → 單元素陣列)。 */
  outputs: Record<string, unknown> | Record<string, unknown>[] | null;
  usedDefault: boolean;
  /** 不得靜默:呼叫端/UI 必須呈現。 */
  ruleErrors: RuleError[];
}

export async function evaluateTable(
  table: DecisionTable,
  context: unknown,
  opts?: EvaluateOptions,
): Promise<EvaluateResult> {
  const parsed = decisionTableSchema.parse(table); // 邊界驗證,invalid 即 throw
  const ruleErrors: RuleError[] = [];

  const fail = (err: RuleError): void => {
    ruleErrors.push(err);
    if (opts?.strict) throw new DecisionTableError([err]);
  };

  // 逐列命中判斷(有序)。
  const matchedRules: DecisionRule[] = [];
  for (const rule of parsed.rules) {
    const res = runLiveMatch([context], rule.when);
    if (res.uncoverable) {
      fail({
        ruleId: rule.id,
        kind: 'uncoverable',
        message: 'condition uses operators data-filter cannot evaluate in memory',
      });
      continue;
    }
    if (res.count === 1) {
      matchedRules.push(rule);
      if (parsed.hitPolicy === 'first') break;
    }
  }

  // 輸出解析:常值原樣;"=" 前綴走 data-expr(循序 await —— CompiledExpr 不可併發)。
  const resolveOutputs = async (ruleId: string, outputs: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(outputs)) {
      if (typeof value === 'string' && isExpression(value)) {
        try {
          resolved[key] = await evaluateExpr(stripExpressionPrefix(value), context);
        } catch (e) {
          resolved[key] = undefined;
          fail({
            ruleId,
            kind: 'expression',
            message: `output "${key}": ${e instanceof Error ? e.message : String(e)}`,
          });
        }
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  };

  let outputs: EvaluateResult['outputs'];
  let usedDefault = false;

  if (matchedRules.length > 0) {
    if (parsed.hitPolicy === 'first') {
      const first = matchedRules[0]!;
      outputs = await resolveOutputs(first.id, first.outputs);
    } else {
      const collected: Record<string, unknown>[] = [];
      for (const rule of matchedRules) collected.push(await resolveOutputs(rule.id, rule.outputs));
      outputs = collected;
    }
  } else if (parsed.defaultOutputs) {
    usedDefault = true;
    const resolved = await resolveOutputs('__default__', parsed.defaultOutputs);
    outputs = parsed.hitPolicy === 'first' ? resolved : [resolved];
  } else {
    outputs = parsed.hitPolicy === 'first' ? null : [];
  }

  return {
    hitPolicy: parsed.hitPolicy,
    matched: matchedRules.map((r) => r.id),
    outputs,
    usedDefault,
    ruleErrors,
  };
}
```

`packages/decision-table/src/index.ts` 末尾加:

```ts
export * from './evaluate';
```

- [ ] **Step 4: 跑測試 + typecheck 確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/decision-table vitest:run && pnpm -C <worktree> --filter @rfjs/decision-table typecheck`
Expected: PASS(全部,約 18 個)。JSONata 語法注意:`'= "routed for " & dept'` 是字串串接;若 `$notAFunction(` 沒有讓 data-expr throw(compile 錯誤應 throw),改用 `'= $undefinedFn()'` 之類確保 reject 的表達式(以實測為準,測試意圖是「表達式失敗路徑」)。

- [ ] **Step 5: Commit**

```bash
git add packages/decision-table/src/evaluate.ts packages/decision-table/src/evaluate.spec.ts packages/decision-table/src/index.ts
git commit -m "feat(decision-table): add evaluateTable engine (first/collect, expressions, explicit errors)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: README + build/lint 綠燈 + changeset(套件完成 gate)

**Files:**
- Create: `packages/decision-table/README.md`
- Create: `packages/decision-table/README.zh-TW.md`
- Create: `.changeset/decision-table-initial.md`

**Interfaces:** 無新增程式介面。

- [ ] **Step 1: 寫 `packages/decision-table/README.md`**

````markdown
# @rfjs/decision-table

DMN-style decision table composed from the @rfjs stack: each rule's condition is a
[`@rfjs/filter-builder`](../filter-builder) tree (arbitrarily nested and/or/nor/not +
elemmatch), outputs are constants or [`@rfjs/data-expr`](../data-expr) `"="` expressions
evaluated against the context, with `first` / `collect` hit policies and optional
`defaultOutputs`.

## Usage

```ts
import { evaluateTable, type DecisionTable } from '@rfjs/decision-table';

const table: DecisionTable = {
  version: 1,
  outputs: [{ key: 'approver' }],
  hitPolicy: 'first',
  rules: [
    { id: 'big', when: /* BuilderGroup: amount > 100000 */ group, outputs: { approver: 'CFO' } },
  ],
  defaultOutputs: { approver: 'Direct Manager' },
};

const result = await evaluateTable(table, { amount: 200000 });
// result.outputs → { approver: 'CFO' }; result.matched → ['big']
```

- Async (data-expr / JSONata). Rules whose conditions use operators `data-filter`
  cannot evaluate in memory are **never silently treated as non-matching** — they are
  skipped and reported in `result.ruleErrors` (or thrown with `{ strict: true }`).
- Nested tables are out of scope by design: chain decisions by orchestration
  (e.g. two decision-table nodes in a flow), not inside the table.
````

- [ ] **Step 2: 寫 `packages/decision-table/README.zh-TW.md`**

````markdown
# @rfjs/decision-table

以 @rfjs 既有套件組合出的 DMN 風格決策表:每列規則的條件是
[`@rfjs/filter-builder`](../filter-builder) 條件樹(任意巢狀 and/or/nor/not + elemmatch),
輸出為常值或 [`@rfjs/data-expr`](../data-expr) 的 `"="` 表達式(對 context 運算),
支援 `first` / `collect` 兩種 hit policy 與可選的 `defaultOutputs`。

## 用法

```ts
import { evaluateTable, type DecisionTable } from '@rfjs/decision-table';

const result = await evaluateTable(table, { amount: 200000 });
// result.outputs → { approver: 'CFO' };result.matched → ['big']
```

- **async**(data-expr / JSONata 本質)。
- 條件用了 data-filter 無法在記憶體評估的運算子時,該列**絕不靜默視為不命中** ——
  會跳過並記入 `result.ruleErrors`(`{ strict: true }` 時直接 throw)。
- 表巢狀(表呼叫表)刻意不做:決策鏈交給編排層(例如 flow 串兩個 decision-table 節點)。
````

- [ ] **Step 3: 建 `.changeset/decision-table-initial.md`**

```markdown
---
'@rfjs/decision-table': minor
---

Add `@rfjs/decision-table` — DMN-style decision table over the @rfjs stack: rules are filter-builder condition trees, outputs are constants or data-expr `"="` expressions, with `first`/`collect` hit policies, `defaultOutputs`, and explicit uncoverable/expression error reporting.
```

- [ ] **Step 4: 套件 gate 全綠(build/lint/typecheck/test)**

Run:
```bash
pnpm -C <worktree> --filter @rfjs/decision-table build
pnpm -C <worktree> --filter @rfjs/decision-table lint
pnpm -C <worktree> --filter @rfjs/decision-table typecheck
pnpm -C <worktree> --filter @rfjs/decision-table vitest:run
```
Expected: build 產出 `dist/index.{js,mjs,d.ts}`;lint 0 problems;typecheck 無錯誤;測試全 passed。

- [ ] **Step 5: Commit**

```bash
git add packages/decision-table/README.md packages/decision-table/README.zh-TW.md .changeset/decision-table-initial.md
git commit -m "docs(decision-table): add readme (en + zh-tw) and initial changeset

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: 展示 tool 的範例與 i18n(sample.ts + messages.ts)

**先決:** apps/web 要能 import `@rfjs/decision-table`(dist 已於 Task 4 建好)。

**Files:**
- Modify: `apps/web/package.json`(dependencies 加 `"@rfjs/decision-table": "workspace:*"`)
- Create: `apps/web/src/tools/decision-table/sample.ts`
- Create: `apps/web/src/tools/decision-table/messages.ts`
- Test: `apps/web/src/tools/decision-table/sample.spec.ts`

**Interfaces:**
- Produces:
  - `const sampleTable: DecisionTable`(簽核路由:3 列規則,含一列 `"="` 表達式輸出、一列巢狀 AND;inputs 定義 `amount`(numeric)/`dept`(string);outputs `approver` + `note`;defaultOutputs)
  - `const sampleBatch: Record<string, unknown>[]`(4 筆 context)
  - `const messages: LocaleMessages`(`Tools["decision-table"]` + `ToolUI` `dt*` 鍵,en + zh-TW)

- [ ] **Step 1: 加相依並 install**

`apps/web/package.json` dependencies 加(`@rfjs/data-filter` 附近字母序):
```json
    "@rfjs/decision-table": "workspace:*",
```
Run: `pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-decision-table install`
Expected: 連結成功,lockfile 更新。

- [ ] **Step 2: 寫失敗測試 `apps/web/src/tools/decision-table/sample.spec.ts`**

```ts
import { describe, expect, it } from "vitest";
import { decisionTableSchema, evaluateTable } from "@rfjs/decision-table";

import { sampleTable, sampleBatch } from "./sample";

describe("decision-table sample", () => {
  it("is schema-valid and routes a big amount to the CFO", async () => {
    expect(() => decisionTableSchema.parse(sampleTable)).not.toThrow();
    const r = await evaluateTable(sampleTable, { amount: 200000, dept: "Engineering" });
    expect(r.matched.length).toBeGreaterThan(0);
    expect((r.outputs as Record<string, unknown>).approver).toBe("CFO");
    expect(r.ruleErrors).toEqual([]);
  });

  it("falls back to defaultOutputs for a small unmatched request", async () => {
    const r = await evaluateTable(sampleTable, { amount: 100, dept: "HR" });
    expect(r.usedDefault).toBe(true);
  });

  it("ships a batch of at least 4 sample contexts", () => {
    expect(sampleBatch.length).toBeGreaterThanOrEqual(4);
    for (const row of sampleBatch) expect(typeof row).toBe("object");
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- decision-table/sample`
Expected: FAIL —— 找不到 `./sample`。

- [ ] **Step 4: 實作 `apps/web/src/tools/decision-table/sample.ts`**

```ts
import type { DecisionTable } from "@rfjs/decision-table";
import type { BuilderGroup } from "@rfjs/filter-builder";

const g = (id: string, children: BuilderGroup["children"]): BuilderGroup => ({
  kind: "group",
  id,
  logic: "and",
  children,
});

/** 範例:簽核路由 —— 金額/部門 → 簽核人。含一列巢狀 AND 與一個 "=" 表達式輸出。 */
export const sampleTable: DecisionTable = {
  version: 1,
  name: "Approval routing",
  inputs: [
    { path: "amount", dataType: "numeric", include: true, kind: "jsonb" },
    { path: "dept", dataType: "string", include: true, kind: "jsonb" },
  ],
  outputs: [
    { key: "approver", label: "Approver" },
    { key: "note", label: "Note" },
  ],
  hitPolicy: "first",
  rules: [
    {
      id: "rule-cfo",
      description: "Big spend goes to the CFO",
      when: g("g-cfo", [
        { kind: "condition", id: "c-cfo", field: "amount", dataType: "numeric", operator: "gt", value: 100000 },
      ]),
      outputs: { approver: "CFO", note: "= \"amount \" & $string(amount)" },
    },
    {
      id: "rule-eng",
      description: "Mid-size engineering spend",
      when: g("g-eng", [
        { kind: "condition", id: "c-e1", field: "amount", dataType: "numeric", operator: "gt", value: 50000 },
        { kind: "condition", id: "c-e2", field: "dept", dataType: "string", operator: "eq", value: "Engineering" },
      ]),
      outputs: { approver: "VP Engineering", note: "escalated" },
    },
    {
      id: "rule-fin",
      description: "Finance requests",
      when: g("g-fin", [
        { kind: "condition", id: "c-f1", field: "dept", dataType: "string", operator: "eq", value: "Finance" },
      ]),
      outputs: { approver: "Finance Manager", note: "standard" },
    },
  ],
  defaultOutputs: { approver: "Direct Manager", note: "auto" },
};

/** 批次試算範例 rows。 */
export const sampleBatch: Record<string, unknown>[] = [
  { amount: 200000, dept: "Engineering" },
  { amount: 60000, dept: "Engineering" },
  { amount: 30000, dept: "Finance" },
  { amount: 500, dept: "HR" },
];
```

- [ ] **Step 5: 寫 `apps/web/src/tools/decision-table/messages.ts`**

```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "decision-table": {
        title: "Decision Table",
        description:
          "DMN-style decision table — rules are nested filter trees, outputs are constants or expressions; evaluate one context or a whole batch live.",
      },
    },
    ToolUI: {
      dtEyebrow: "DECISION TABLE",
      dtRules: "Rules",
      dtAddRule: "+ Rule",
      dtRemoveRule: "Remove",
      dtMoveUp: "Up",
      dtMoveDown: "Down",
      dtEditRule: "Edit rule",
      dtRuleSheetTitle: "Rule",
      dtClose: "Close",
      dtDescription: "Description",
      dtCondition: "Condition",
      dtOutputs: "Outputs",
      dtOutputHint: "constant, or =expression (JSONata)",
      dtHitPolicy: "Hit policy",
      dtSingleEval: "Try one context",
      dtBatchEval: "Batch",
      dtContextLabel: "Context JSON",
      dtBatchLabel: "Rows JSON (array)",
      dtRun: "Evaluate",
      dtMatched: "Matched",
      dtNoMatch: "No match",
      dtUsedDefault: "default used",
      dtRuleErrors: "Rule errors",
      dtInvalidJson: "Invalid JSON",
      dtJson: "Table JSON",
      dtImport: "Import",
      dtImportInvalid: "Not a valid decision table",
      dtFilterAddCondition: "+ condition",
      dtFilterAddGroup: "+ group",
      dtFilterRemoveGroup: "remove group",
      dtFilterRemoveCondition: "remove",
      dtFilterElemMatch: "elemmatch",
    },
  },
  "zh-TW": {
    Tools: {
      "decision-table": {
        title: "決策表",
        description:
          "DMN 風格決策表 —— 規則條件是可巢狀的 filter 樹,輸出為常值或表達式;可即時試算單筆 context 或整批資料。",
      },
    },
    ToolUI: {
      dtEyebrow: "決策表",
      dtRules: "規則",
      dtAddRule: "+ 規則",
      dtRemoveRule: "移除",
      dtMoveUp: "上移",
      dtMoveDown: "下移",
      dtEditRule: "編輯規則",
      dtRuleSheetTitle: "規則",
      dtClose: "關閉",
      dtDescription: "描述",
      dtCondition: "條件",
      dtOutputs: "輸出",
      dtOutputHint: "常值,或 =表達式(JSONata)",
      dtHitPolicy: "命中策略",
      dtSingleEval: "單筆試算",
      dtBatchEval: "批次",
      dtContextLabel: "Context JSON",
      dtBatchLabel: "Rows JSON(陣列)",
      dtRun: "試算",
      dtMatched: "命中",
      dtNoMatch: "無命中",
      dtUsedDefault: "已用預設",
      dtRuleErrors: "規則錯誤",
      dtInvalidJson: "JSON 無效",
      dtJson: "表格 JSON",
      dtImport: "匯入",
      dtImportInvalid: "不是合法的決策表",
      dtFilterAddCondition: "+ 條件",
      dtFilterAddGroup: "+ 群組",
      dtFilterRemoveGroup: "移除群組",
      dtFilterRemoveCondition: "移除",
      dtFilterElemMatch: "elemmatch",
    },
  },
};
```

- [ ] **Step 6: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- decision-table/sample`
Expected: PASS(3 passed)。JSONata 表達式 `"amount " & $string(amount)` 若運算失敗(以實測為準),改為 `= $string(amount)` 並同步調整 spec 斷言意圖(表達式輸出存在即可)。

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/tools/decision-table/sample.ts \
  apps/web/src/tools/decision-table/sample.spec.ts apps/web/src/tools/decision-table/messages.ts
git commit -m "feat(web): add decision-table tool sample data and i18n messages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: 展示 tool UI(rule-sheet + ui + index,TDD)

**Files:**
- Create: `apps/web/src/tools/decision-table/rule-sheet.tsx`
- Create: `apps/web/src/tools/decision-table/ui.tsx`
- Create: `apps/web/src/tools/decision-table/index.ts`
- Test: `apps/web/src/tools/decision-table/ui.spec.tsx`

**Interfaces:**
- Consumes: `sampleTable`/`sampleBatch`(./sample)、`messages`(./messages)、`evaluateTable`/`tableToJson`/`parseTable`/`newRule`/`moveRule` + types(`@rfjs/decision-table`)、`FilterTreeEditor` + `FilterTreeLabels`(`@rfjs/filter-builder-ui`)、`Button`/`Select*`(`@rfjs/web-ui`)、`ToolModule`(`@/tools/types`)
- Produces: `function DecisionTableTool()`;`const tool: ToolModule = { id: "decision-table", Component: DecisionTableTool }`

**紅線:** 不 import `apps/web/src/tools/flow-builder/` 的任何檔案 —— `rule-sheet.tsx` 是**複製** node-sheet 的模式(backdrop + Esc/X 關閉的寬滑出面板),不是引用。

- [ ] **Step 1: 寫 `apps/web/src/tools/decision-table/rule-sheet.tsx`**

```tsx
"use client";

import * as React from "react";
import { X } from "lucide-react";

import { Button } from "@rfjs/web-ui/components/button";

/** 寬滑出面板(複製 flow-builder node-sheet 模式;不得跨 tool 引用)。 */
export function RuleSheet({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(92vw,860px)] flex-col border-l bg-background shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">{title}</p>
          <Button size="icon" variant="ghost" aria-label={closeLabel} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: 寫失敗測試 `apps/web/src/tools/decision-table/ui.spec.tsx`**

> mock `@rfjs/filter-builder-ui`(重編輯器);`@rfjs/decision-table` 用**真的**(評估行為是本 tool 的核心,不 mock)。jsdom shims 比照其他 tool。

```tsx
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/filter-builder-ui", () => ({
  FilterTreeEditor: () => <div data-testid="fte" />,
}));

import { messages } from "./messages";
import { DecisionTableTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <DecisionTableTool />
    </NextIntlClientProvider>,
  );
}

describe("DecisionTableTool", () => {
  it("renders the sample rules", () => {
    renderTool();
    expect(screen.getByText(/big spend goes to the cfo/i)).toBeTruthy();
    expect(screen.getByText(/finance requests/i)).toBeTruthy();
  });

  it("single evaluation shows the routed approver", async () => {
    renderTool();
    const ta = screen.getByLabelText(/context json/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '{"amount": 200000, "dept": "Engineering"}' } });
    fireEvent.click(screen.getAllByRole("button", { name: /^evaluate$/i })[0]!);
    await waitFor(() => expect(screen.getAllByText(/cfo/i).length).toBeGreaterThan(0));
  });

  it("batch evaluation renders one result row per context", async () => {
    renderTool();
    const ta = screen.getByLabelText(/rows json/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '[{"amount":200000},{"amount":1,"dept":"HR"}]' } });
    fireEvent.click(screen.getAllByRole("button", { name: /^evaluate$/i })[1]!);
    await waitFor(() => {
      expect(screen.getAllByTestId("dt-batch-row")).toHaveLength(2);
    });
  });

  it("opening a rule mounts the embedded FilterTreeEditor in a dialog", () => {
    renderTool();
    fireEvent.click(screen.getAllByRole("button", { name: /edit rule/i })[0]!);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByTestId("fte")).toBeTruthy();
  });

  it("json import rejects an invalid table", async () => {
    renderTool();
    const ta = screen.getByLabelText(/table json/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: '{"version": 2}' } });
    fireEvent.click(screen.getByRole("button", { name: /^import$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- decision-table/ui`
Expected: FAIL —— 找不到 `./ui`。

- [ ] **Step 4: 實作 `apps/web/src/tools/decision-table/ui.tsx`**

> 結構直落式:規則表 → hitPolicy → 單筆試算 → 批次試算 → JSON。試算為 async:用遞增 seq 丟棄過期結果(比照 bpmn import 競態原則)。錯誤(`ruleErrors`/JSON parse)一律可見呈現。

```tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  evaluateTable,
  parseTable,
  tableToJson,
  newRule,
  moveRule,
  type DecisionTable,
  type DecisionRule,
  type EvaluateResult,
} from "@rfjs/decision-table";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";
import { Button } from "@rfjs/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";

import { RuleSheet } from "./rule-sheet";
import { sampleTable, sampleBatch } from "./sample";

const uuid = () => crypto.randomUUID();

function useFilterLabels(): FilterTreeLabels {
  const t = useTranslations("ToolUI");
  return {
    logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
    addCondition: t("dtFilterAddCondition"),
    addGroup: t("dtFilterAddGroup"),
    removeGroup: t("dtFilterRemoveGroup"),
    removeCondition: t("dtFilterRemoveCondition"),
    elemMatch: t("dtFilterElemMatch"),
  };
}

function outputsSummary(outputs: Record<string, unknown>): string {
  return Object.entries(outputs)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" · ");
}

function ResultView({ result, t }: { result: EvaluateResult; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="font-semibold">{t("dtMatched")}:</span>{" "}
        {result.matched.length > 0 ? result.matched.join(", ") : t("dtNoMatch")}
        {result.usedDefault ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{t("dtUsedDefault")}</span> : null}
      </p>
      <pre className="overflow-auto rounded-md border bg-muted/30 p-2 text-xs">{JSON.stringify(result.outputs, null, 2)}</pre>
      {result.ruleErrors.length > 0 ? (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          <p className="font-semibold">{t("dtRuleErrors")}</p>
          {result.ruleErrors.map((e, i) => (
            <p key={i}>{`[${e.kind}] ${e.ruleId}: ${e.message}`}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DecisionTableTool() {
  const t = useTranslations("ToolUI");
  const filterLabels = useFilterLabels();

  const [table, setTable] = React.useState<DecisionTable>(sampleTable);
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null);

  // 單筆試算
  const [contextText, setContextText] = React.useState('{"amount": 60000, "dept": "Engineering"}');
  const [singleResult, setSingleResult] = React.useState<EvaluateResult | null>(null);
  const [singleError, setSingleError] = React.useState<string | null>(null);
  // 批次試算
  const [batchText, setBatchText] = React.useState(() => JSON.stringify(sampleBatch, null, 2));
  const [batchResults, setBatchResults] = React.useState<{ context: unknown; result: EvaluateResult }[] | null>(null);
  const [batchError, setBatchError] = React.useState<string | null>(null);
  // JSON 匯入
  const [importText, setImportText] = React.useState("");
  const [importError, setImportError] = React.useState<string | null>(null);

  const evalSeq = React.useRef(0);

  const runSingle = async () => {
    const seq = ++evalSeq.current;
    try {
      const ctx = JSON.parse(contextText);
      const result = await evaluateTable(table, ctx);
      if (seq !== evalSeq.current) return; // 過期結果丟棄
      setSingleError(null);
      setSingleResult(result);
    } catch (e) {
      if (seq !== evalSeq.current) return;
      setSingleResult(null);
      setSingleError(e instanceof SyntaxError ? t("dtInvalidJson") : String(e));
    }
  };

  const runBatch = async () => {
    const seq = ++evalSeq.current;
    try {
      const rows = JSON.parse(batchText);
      if (!Array.isArray(rows)) throw new SyntaxError("not an array");
      const results: { context: unknown; result: EvaluateResult }[] = [];
      for (const row of rows) results.push({ context: row, result: await evaluateTable(table, row) });
      if (seq !== evalSeq.current) return;
      setBatchError(null);
      setBatchResults(results);
    } catch (e) {
      if (seq !== evalSeq.current) return;
      setBatchResults(null);
      setBatchError(e instanceof SyntaxError ? t("dtInvalidJson") : String(e));
    }
  };

  const updateRule = (id: string, patch: Partial<DecisionRule>) => {
    setTable((tb) => ({ ...tb, rules: tb.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  };

  const editingRule = table.rules.find((r) => r.id === editingRuleId) ?? null;
  const schema = (table.inputs ?? []) as FieldSchema[];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("dtEyebrow")}</p>

      {/* 規則表 */}
      <div className="rounded-md border">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">{t("dtRules")}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("dtHitPolicy")}</span>
            <Select
              value={table.hitPolicy}
              onValueChange={(v) => setTable((tb) => ({ ...tb, hitPolicy: v as DecisionTable["hitPolicy"] }))}
            >
              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first">first</SelectItem>
                <SelectItem value="collect">collect</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setTable((tb) => ({ ...tb, rules: [...tb.rules, newRule(uuid)] }))}>
              {t("dtAddRule")}
            </Button>
          </div>
        </div>
        <ul className="divide-y">
          {table.rules.map((rule, i) => (
            <li key={rule.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{rule.description ?? rule.id}</span>
              <span className="hidden max-w-[40%] truncate text-xs text-muted-foreground sm:block">{outputsSummary(rule.outputs)}</span>
              <Button size="sm" variant="ghost" aria-label={t("dtMoveUp")} disabled={i === 0}
                onClick={() => setTable((tb) => moveRule(tb, i, i - 1))}>↑</Button>
              <Button size="sm" variant="ghost" aria-label={t("dtMoveDown")} disabled={i === table.rules.length - 1}
                onClick={() => setTable((tb) => moveRule(tb, i, i + 1))}>↓</Button>
              <Button size="sm" variant="outline" onClick={() => setEditingRuleId(rule.id)}>{t("dtEditRule")}</Button>
              <Button size="sm" variant="ghost" onClick={() => setTable((tb) => ({ ...tb, rules: tb.rules.filter((r) => r.id !== rule.id) }))}>
                {t("dtRemoveRule")}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* 單筆試算 */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-semibold">{t("dtSingleEval")}</p>
          <label htmlFor="dt-context" className="text-xs text-muted-foreground">{t("dtContextLabel")}</label>
          <textarea id="dt-context" rows={4} value={contextText} onChange={(e) => setContextText(e.target.value)}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
          <Button size="sm" onClick={runSingle}>{t("dtRun")}</Button>
          {singleError ? <p role="alert" className="text-xs text-destructive">{singleError}</p> : null}
          {singleResult ? <ResultView result={singleResult} t={t} /> : null}
        </div>

        {/* 批次試算 */}
        <div className="space-y-2 rounded-md border p-3">
          <p className="text-sm font-semibold">{t("dtBatchEval")}</p>
          <label htmlFor="dt-batch" className="text-xs text-muted-foreground">{t("dtBatchLabel")}</label>
          <textarea id="dt-batch" rows={4} value={batchText} onChange={(e) => setBatchText(e.target.value)}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs" />
          <Button size="sm" onClick={runBatch}>{t("dtRun")}</Button>
          {batchError ? <p role="alert" className="text-xs text-destructive">{batchError}</p> : null}
          {batchResults ? (
            <ul className="space-y-1 text-xs">
              {batchResults.map((r, i) => (
                <li key={i} data-testid="dt-batch-row" className="rounded border px-2 py-1">
                  <span className="text-muted-foreground">{JSON.stringify(r.context)}</span>{" → "}
                  <span className="font-medium">
                    {r.result.matched.length > 0 ? r.result.matched.join(",") : t("dtNoMatch")}
                  </span>{" · "}
                  <span>{JSON.stringify(r.result.outputs)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* JSON 面板 */}
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-semibold">{t("dtJson")}</p>
        <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-2 text-[11px]">{tableToJson(table)}</pre>
        <label htmlFor="dt-import" className="text-xs text-muted-foreground">{t("dtImport")}</label>
        <textarea id="dt-import" rows={3} value={importText} onChange={(e) => setImportText(e.target.value)}
          className="w-full rounded-md border bg-background p-2 font-mono text-xs" aria-label={t("dtJson")} />
        <Button size="sm" variant="outline" onClick={() => {
          try {
            setTable(parseTable(importText));
            setImportError(null);
          } catch {
            setImportError(t("dtImportInvalid"));
          }
        }}>{t("dtImport")}</Button>
        {importError ? <p role="alert" className="text-xs text-destructive">{importError}</p> : null}
      </div>

      {/* 規則編輯 sheet */}
      {editingRule ? (
        <RuleSheet title={`${t("dtRuleSheetTitle")} — ${editingRule.id}`} closeLabel={t("dtClose")} onClose={() => setEditingRuleId(null)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="dt-rule-desc" className="mb-1 block text-xs text-muted-foreground">{t("dtDescription")}</label>
              <input id="dt-rule-desc" value={editingRule.description ?? ""}
                onChange={(e) => updateRule(editingRule.id, { description: e.target.value })}
                className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("dtCondition")}</p>
              <FilterTreeEditor
                group={editingRule.when as BuilderGroup}
                engineId="data-filter"
                schema={schema}
                labels={filterLabels}
                onChange={(next) => updateRule(editingRule.id, { when: next })}
                onCreateField={(path) =>
                  setTable((tb) => ({
                    ...tb,
                    inputs: [...(tb.inputs ?? []), { path, dataType: "string", include: true, kind: "jsonb" }],
                  }))
                }
              />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("dtOutputs")}</p>
              {table.outputs.map((def) => (
                <div key={def.key} className="mb-2">
                  <label htmlFor={`dt-out-${def.key}`} className="mb-0.5 block text-xs">{def.label ?? def.key}</label>
                  <input
                    id={`dt-out-${def.key}`}
                    value={String(editingRule.outputs[def.key] ?? "")}
                    placeholder={t("dtOutputHint")}
                    onChange={(e) => updateRule(editingRule.id, { outputs: { ...editingRule.outputs, [def.key]: e.target.value } })}
                    className="w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </RuleSheet>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: 寫 `apps/web/src/tools/decision-table/index.ts`**

```ts
import type { ToolModule } from "@/tools/types";

import { DecisionTableTool } from "./ui";

export const tool: ToolModule = { id: "decision-table", Component: DecisionTableTool };
```

- [ ] **Step 6: 跑測試 + typecheck 確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- decision-table && pnpm -C <worktree> --filter web check-types`
Expected: PASS(sample 3 + ui 5 = 8);typecheck 無錯誤。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tools/decision-table/rule-sheet.tsx apps/web/src/tools/decision-table/ui.tsx \
  apps/web/src/tools/decision-table/index.ts apps/web/src/tools/decision-table/ui.spec.tsx
git commit -m "feat(web): add decision-table tool ui (rules editor, single and batch eval, json)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: 註冊 tool(registry + package catalog + 聚合器 + i18n)

**Files:**
- Modify: `apps/web/src/tools/index.spec.ts`(EXPECTED ids 加 `"decision-table"` —— 先改,test-first)
- Modify: `packages/web-core/src/registry/tools.ts`(append tool 條目)
- Modify: `packages/web-core/src/registry/packages.ts`(append `@rfjs/decision-table` 條目)
- Modify: `apps/web/src/tools/index.ts` + `apps/web/src/tools/messages.ts`(aggregators append)
- Modify: `apps/web/src/messages/en.json` + `apps/web/src/messages/zh-TW.json`(`Packages.decision-table.description`)

**Interfaces:**
- Consumes: `tool`、`messages` from `./decision-table`(Task 5/6)

- [ ] **Step 1: 先改 EXPECTED ids 讓它失敗** — `apps/web/src/tools/index.spec.ts` 陣列尾端(`"flow-builder",` 之後)加:

```ts
  "flow-builder",
  "decision-table",
].sort();
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- tools/index`
Expected: FAIL。

- [ ] **Step 3: web-core registry append** — `packages/web-core/src/registry/tools.ts` 在 `flow-builder` 條目之後、`object-transformer` 之前插入:

```ts
  {
    id: 'decision-table',
    category: 'transform',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/decision-table', '@rfjs/filter-builder'],
    tags: ['decision', 'rules', 'routing', 'dmn'],
  },
```

- [ ] **Step 4: package catalog append** — `packages/web-core/src/registry/packages.ts` 在 `@rfjs/filter-builder` 條目之後插入(**無 npm 欄位**,發佈後再補):

```ts
  {
    name: '@rfjs/decision-table',
    status: 'preview',
    href: '/packages/decision-table',
    github: GITHUB,
    tags: ['decision', 'rules', 'dmn'],
    relatedTools: ['decision-table'],
  },
```

- [ ] **Step 5: aggregators append**

`apps/web/src/tools/index.ts`:
```ts
import { tool as decisionTable } from "./decision-table";
```
陣列尾端:
```ts
  flowBuilder,
  decisionTable,
];
```
`apps/web/src/tools/messages.ts`:
```ts
import { messages as decisionTable } from "./decision-table/messages";
```
陣列尾端(順序與 index.ts 對齊):
```ts
  flowBuilder,
  decisionTable,
];
```

- [ ] **Step 6: Packages i18n** — `apps/web/src/messages/en.json` 的 `Packages` 物件加(位置比照其他鍵,如 `filter-builder` 之後):

```json
    "decision-table": { "description": "DMN-style decision table: rules as nested filter trees, constant or expression outputs, first/collect hit policies." }
```

`apps/web/src/messages/zh-TW.json` 同位置加:

```json
    "decision-table": { "description": "DMN 風格決策表:規則為可巢狀的 filter 樹,輸出支援常值或表達式,提供 first/collect 命中策略。" }
```

- [ ] **Step 7: 全部相關測試綠燈**

Run:
```bash
pnpm -C <worktree> --filter web vitest:run -- tools/index
pnpm -C <worktree> --filter @rfjs/web-core test
pnpm -C <worktree> --filter web vitest:run
pnpm -C <worktree> --filter web check-types
```
Expected: 全綠(registry 雙向引用、聚合器一致、ToolUI 無衝突、i18n-content 的 Packages 描述檢查通過)。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/tools/index.spec.ts packages/web-core/src/registry/tools.ts \
  packages/web-core/src/registry/packages.ts apps/web/src/tools/index.ts \
  apps/web/src/tools/messages.ts apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json
git commit -m "feat(web): register decision-table tool and package catalog entry

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: e2e + 終審驗證

**Files:**
- Create: `apps/web/e2e/decision-table.e2e.ts`

- [ ] **Step 1: 建 `apps/web/e2e/decision-table.e2e.ts`**

```ts
import { test, expect } from "@playwright/test";

const URL = "/en/tools/decision-table";

test("renders the sample decision table", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText(/big spend goes to the cfo/i)).toBeVisible({ timeout: 15_000 });
});

test("single evaluation routes a big amount to the CFO", async ({ page }) => {
  await page.goto(URL);
  await page.locator("#dt-context").fill('{"amount": 200000, "dept": "Engineering"}');
  await page.getByRole("button", { name: /^evaluate$/i }).first().click();
  await expect(page.getByText(/"approver": "CFO"/)).toBeVisible({ timeout: 15_000 });
});

test("table json panel shows the document", async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByText('"version": 1').first()).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 2: 終審驗證(全 gate)**

Run:
```bash
pnpm -C <worktree> --filter @rfjs/decision-table build
pnpm -C <worktree> --filter @rfjs/decision-table lint
pnpm -C <worktree> --filter @rfjs/decision-table typecheck
pnpm -C <worktree> --filter @rfjs/decision-table vitest:run
pnpm -C <worktree> --filter @rfjs/web-core test
pnpm -C <worktree> --filter web check-types
pnpm -C <worktree> --filter web lint
pnpm -C <worktree> --filter web vitest:run
pnpm -C <worktree> --filter web build
```
Expected: 全綠;`next build` 成功 prerender(SSR 安全)。

- [ ] **Step 3: 跑 e2e(production server,勿用 next dev)**

Run:
```bash
cd <worktree>/apps/web && pnpm exec next start --port 3002 &   # 背景;結束後記得停掉
pnpm -C <worktree> --filter web test:e2e -- decision-table
```
Expected: 3 passed(playwright.config 的 webServer 會重用既有 3002 server)。
> 沙箱若無法跑瀏覽器,記錄為已知限制,檔案照 commit(比照先前慣例)。

- [ ] **Step 4: 手動截圖驗證(light + dark)**

用上述 production server 開 `http://localhost:3002/en/tools/decision-table` 截圖:規則表渲染、開規則 sheet(FilterTreeEditor 有空間)、單筆/批次試算結果、dark 模式可讀。截圖留存供 PR 說明。

- [ ] **Step 5: Commit + 收尾**

```bash
git add apps/web/e2e/decision-table.e2e.ts
git commit -m "test(web): add playwright e2e smoke for decision-table

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git -C <worktree> status   # 應乾淨
```
**HOLD:** 不開 PR;通知使用者完成 + 截圖摘要,等指示。

---

## 附錄:Spec ↔ Plan 對應(self-review)

| Spec 需求 | 對應 Task |
| --- | --- |
| 套件 scaffold(可發佈、tsdown、dist exports) | Task 1 |
| 型別 + zod schema(結構性 when 驗證、rule id 唯一)+ parse/toJson | Task 1 |
| 編輯輔助 emptyTable/newRule/moveRule | Task 2 |
| evaluateTable:first/collect、defaultOutputs、"=" 表達式、uncoverable/expression 錯誤 + strict、循序 await、邊界驗證 | Task 3 |
| 巢狀:條件巢狀(多條件 AND、elemmatch 測試)、資料巢狀(JSONata) | Task 3(測試)+ Task 5(範例) |
| README en/zh + changeset | Task 4 |
| 範例(簽核路由,含 "=" 表達式)+ 批次 rows | Task 5 |
| tool UI:規則表編輯、rule sheet(FilterTreeEditor)、hitPolicy、單筆/批次試算、JSON 匯入匯出、錯誤可見 | Task 6 |
| 不 import flow-builder 檔案(並行紅線) | Task 6(RuleSheet 為複製) |
| 註冊:tools.ts + packages.ts + 聚合器 + EXPECTED ids + Packages i18n;不動 next.config | Task 7 |
| e2e + next build SSR + 截圖 + HOLD | Task 8 |
| 非目標(其他 hit policy、表巢狀、AI、DMN XML) | 全程不實作 |
