# @rfjs/filter-builder 抽取 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 apps/web query-builder 的框架無關邏輯抽成新 public 套件 `@rfjs/filter-builder`,並讓 apps/web 改用它 —— 行為完全不變。

**Architecture:** 這是「行為不變的搬遷」。整個 `apps/web/src/tools/query-builder/logic/`(除 `colors.ts`,它綁 Tailwind)本來就是純 TS。流程:scaffold 套件 → **複製** logic + spec 進套件(讓 apps/web 過程中維持綠)→ build → 重指 apps/web 的 import 並刪原檔。搬過去的 `*.spec.ts` 證明行為不變;apps/web 綠(vitest + check-types + build)證明消費端不受影響。

**Tech Stack:** TypeScript、tsdown(ESM+CJS+dts)、Vitest、pnpm workspace。套件相依:`@rfjs/pg-filter`、`@rfjs/jsonb-query`、`@rfjs/data-filter`。

**Spec:** `docs/superpowers/specs/2026-06-16-filter-builder-extract-design.md`

慣例:套件測試 `pnpm -F @rfjs/filter-builder vitest:run`;web 測試 `pnpm -F web vitest:run`;web 型別檢查 `pnpm -F web check-types`。workspace `@rfjs/*` 相依需先 build(`pnpm build:packages`)vitest/tsc/build 才解析得到。commit subject 小寫(commitlint);**絕不**用 `--no-verify`;commit 訊息用英文。

---

## 檔案結構

**新套件 `packages/filter-builder/`**(鏡像 `packages/pg-filter/`):
- `package.json`、`tsconfig.json`、`tsconfig.build.json`、`tsdown.config.ts`、`vitest.config.mts`
- `src/<module>.ts` + `src/<module>.spec.ts` —— 搬過來的 logic 模組(types、tree-ops、compile、reverse、value-coerce、field-kind、field-create、schema-infer、live-match)
- `src/engines/<module>.ts`(+ specs)—— arity、types、data-filter、jsonb、pg-filter、index
- `src/index.ts` —— barrel(re-export 全部模組;**不含 colors**)

**apps/web 變更:**
- `apps/web/package.json` —— 加 `@rfjs/filter-builder` 依賴
- 刪除 `apps/web/src/tools/query-builder/logic/**`,**保留** `colors.ts` + `colors.spec.ts`
- `apps/web/src/tools/query-builder/logic/colors.ts` —— 型別 import 改指 `@rfjs/filter-builder`
- 重指 import:`ui/index.tsx`、`ui/builder-tree.tsx`、`ui/value-editor.tsx`、`ui/schema-panel.tsx`、`ui/preview-panel.tsx`

---

## Task 1:Scaffold `@rfjs/filter-builder`

**Files:**
- Create: `packages/filter-builder/package.json`
- Create: `packages/filter-builder/tsconfig.json`、`tsconfig.build.json`、`tsdown.config.ts`、`vitest.config.mts`
- Create: `packages/filter-builder/src/index.ts`(暫時空 barrel)

- [ ] **Step 1:建立 `packages/filter-builder/package.json`**

```json
{
  "name": "@rfjs/filter-builder",
  "version": "0.0.0",
  "description": "Framework-agnostic canonical filter-tree builder: editable tree model, tree-ops, schema inference, reverse parse, and compile to @rfjs SQL/data-filter engines",
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
    "typecheck:watch": "tsc --noEmit --watch",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "lint:fix": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "keywords": ["filter", "query-builder", "tree", "canonical", "sql", "jsonb"],
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": { "type": "git", "url": "git+https://github.com/royfw/rfjs.git", "directory": "packages/filter-builder" },
  "bugs": "https://github.com/royfw/rfjs/issues",
  "homepage": "https://github.com/royfw/rfjs/tree/main/packages/filter-builder#readme",
  "files": ["dist", "README.md"],
  "dependencies": {
    "@rfjs/pg-filter": "workspace:*",
    "@rfjs/jsonb-query": "workspace:*",
    "@rfjs/data-filter": "workspace:*"
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

- [ ] **Step 2:從 pg-filter 逐字複製四個設定檔**(它們與套件無關;上面 package.json 已設好 repo `directory`):

Run: `cp packages/pg-filter/tsconfig.json packages/pg-filter/tsconfig.build.json packages/pg-filter/tsdown.config.ts packages/pg-filter/vitest.config.mts packages/filter-builder/`

- [ ] **Step 3:建立暫時空 barrel** `packages/filter-builder/src/index.ts`:
```ts
export {};
```

- [ ] **Step 4:安裝 + 驗證**

Run: `pnpm install`
Then: `pnpm -F @rfjs/filter-builder typecheck && pnpm -F @rfjs/filter-builder vitest:run`
Expected:install 連結套件;typecheck 乾淨;vitest 因 `--passWithNoTests` 以 0 測試通過。

- [ ] **Step 5:Commit**

```bash
git add packages/filter-builder pnpm-lock.yaml
git commit -m "chore(filter-builder): scaffold package"
```

---

## Task 2:把 logic 模組複製進套件 + barrel

本任務 apps/web 自己的 `logic/` 保持不動(讓 apps/web 維持綠);先**複製**進套件,之後(Task 3)才重指 apps/web 並刪原檔。複製過去的檔案保留其相對 import(`./types`、`../compile`…),在套件內部解析不變。

**Files:**
- Create(複製):`packages/filter-builder/src/**`(query-builder `logic/` 全部,除 `colors.ts`/`colors.spec.ts`)
- Modify:`packages/filter-builder/src/index.ts`(正式 barrel)

- [ ] **Step 1:把 logic 樹複製進套件 src**

Run:
```bash
cp -R apps/web/src/tools/query-builder/logic/. packages/filter-builder/src/
rm -f packages/filter-builder/src/colors.ts packages/filter-builder/src/colors.spec.ts packages/filter-builder/src/index.ts
```
(最後的 `rm` 移除 colors —— 它只留在 web —— 以及複製過來的舊 `logic/index.ts` barrel;下一步寫新 barrel。此後 `packages/filter-builder/src/` 應含:`types.ts`、`tree-ops.ts`、`compile.ts`、`reverse.ts`、`value-coerce.ts`、`field-kind.ts`、`field-create.ts`、`schema-infer.ts`、`live-match.ts`、它們的 `*.spec.ts`,以及 `engines/` 下 `types.ts`/`arity.ts`/`data-filter.ts`/`jsonb.ts`/`pg-filter.ts`/`index.ts` + engine specs。)

- [ ] **Step 2:寫套件 barrel** `packages/filter-builder/src/index.ts`:
```ts
export * from './types';
export * from './tree-ops';
export * from './compile';
export * from './reverse';
export * from './value-coerce';
export * from './field-kind';
export * from './field-create';
export * from './schema-infer';
export * from './live-match';
export * from './engines';
```

- [ ] **Step 3:套件 typecheck + 跑搬過來的 specs**

Run: `pnpm -F @rfjs/filter-builder typecheck && pnpm -F @rfjs/filter-builder vitest:run`
Expected:typecheck 乾淨(外部 import `@rfjs/pg-filter`/`@rfjs/jsonb-query`/`@rfjs/data-filter` 經 deps 解析;相對 import 套件內解析);所有搬過來的 spec 通過(數量與搬移前相同 —— tree-ops、compile、reverse、value-coerce、field-kind、field-create、schema-infer、live-match、engines/{pg-filter,jsonb,data-filter,index})。

若 typecheck 因某 dep 的 dist 缺失而失敗,先 `pnpm build:packages` 再重試。

- [ ] **Step 4:Build 套件**(下個任務 apps/web 才解析得到)

Run: `pnpm -F @rfjs/filter-builder build`
Expected:tsdown 產出 `dist/`(esm+cjs+dts)。

- [ ] **Step 5:確認 apps/web 仍綠(未動)**

Run: `pnpm -F web vitest:run query-builder`
Expected:PASS(apps/web 仍用自己本地的 `logic/`;尚未重指任何東西)。

- [ ] **Step 6:Commit**

```bash
git add packages/filter-builder/src
git commit -m "feat(filter-builder): move query-builder logic + engines into the package"
```

---

## Task 3:把 apps/web 重指到套件 + 刪原檔

**Files:**
- Modify: `apps/web/package.json`(加依賴)
- Modify: `apps/web/src/tools/query-builder/ui/index.tsx`、`ui/builder-tree.tsx`、`ui/value-editor.tsx`、`ui/schema-panel.tsx`、`ui/preview-panel.tsx`
- Modify: `apps/web/src/tools/query-builder/logic/colors.ts`
- Delete: `apps/web/src/tools/query-builder/logic/` 下全部,**除** `colors.ts` + `colors.spec.ts`

- [ ] **Step 1:加依賴**

在 `apps/web/package.json` 的 `dependencies` 加 `"@rfjs/filter-builder": "workspace:*"`。然後 `pnpm install`。

- [ ] **Step 2:重指 5 個 ui 檔的 import**

在 `ui/index.tsx`、`ui/builder-tree.tsx`、`ui/value-editor.tsx`、`ui/schema-panel.tsx`、`ui/preview-panel.tsx` 各檔:把所有 specifier 以 `@/tools/query-builder/logic/` 開頭的 import(含 deep 的 `@/tools/query-builder/logic/engines`、`@/tools/query-builder/logic/engines/types`)改成 `@rfjs/filter-builder` —— **唯一例外** `@/tools/query-builder/logic/colors` 維持不變(colors 仍在 web)。

同檔多個 logic import 合併成單一 `import { ... } from "@rfjs/filter-builder";`(例如 `ui/index.tsx` 把 `treeToFilterGroup`、`ENGINE_IDS`/`getEngine`/`EngineId`、`addInferredField`、`runLiveMatch`、`filterGroupToTree`/`mergeFieldsFromTree`/`parseFilterGroup`/`ReverseError`、`inferSchema`、`emptyGroup`、`BuilderGroup`/`FieldSchema` 併成一條)。原本 `import type` 的維持 `import type`。

各檔需要從 `@rfjs/filter-builder` 取的符號:
- `ui/index.tsx`:`treeToFilterGroup`、`ENGINE_IDS`、`getEngine`、`EngineId`、`addInferredField`、`runLiveMatch`、`filterGroupToTree`、`mergeFieldsFromTree`、`parseFilterGroup`、`ReverseError`、`inferSchema`、`emptyGroup`、`BuilderGroup`、`FieldSchema`
- `ui/builder-tree.tsx`:`getEngine`、`EngineId`、`addCondition`、`addGroup`、`removeNode`、`setLogic`、`updateNode`、`BuilderCondition`、`BuilderGroup`、`FieldSchema`、`LogicOp`(**保留** 從 `@/tools/query-builder/logic/colors` import 的 `logicColor`、`dataTypeColor`)
- `ui/value-editor.tsx`:`OperatorArity`、`coerceInput`、`FieldType`
- `ui/schema-panel.tsx`:`canBeColumn`、`FieldKind`、`FieldSchema`、`FieldType`
- `ui/preview-panel.tsx`:`EngineOutput`、`LiveMatchResult`

- [ ] **Step 3:重指 `logic/colors.ts`**

在 `apps/web/src/tools/query-builder/logic/colors.ts`,把它的型別 import 從 `./types` 改成 `@rfjs/filter-builder`(它 import `LogicOp`,若有用到也含 `FieldType`)。colors.ts 其餘不動。

- [ ] **Step 4:刪除搬走的原檔**

Run:
```bash
cd apps/web/src/tools/query-builder/logic
git rm -r engines
git rm types.ts tree-ops.ts compile.ts reverse.ts value-coerce.ts field-kind.ts field-create.ts schema-infer.ts live-match.ts index.ts \
       tree-ops.spec.ts compile.spec.ts reverse.spec.ts value-coerce.spec.ts field-kind.spec.ts field-create.spec.ts schema-infer.spec.ts live-match.spec.ts
```
(只留 `colors.ts` + `colors.spec.ts`。若 `index.ts` 不存在,從 `git rm` 清單移除它。)

- [ ] **Step 5:驗證 apps/web 綠**

Run: `pnpm -F web vitest:run && pnpm -F web check-types && pnpm -F web build`
Expected:web vitest 通過(現在剩 `colors.spec.ts` + `ui/canonical-editor.spec.tsx` + registry/i18n/nav 等);check-types 乾淨(query-builder 邏輯全改由 `@rfjs/filter-builder` 解析);build + SSG 成功。若 barrel 漏了某符號,在 `packages/filter-builder/src/index.ts` 補對應 `export * from './<module>'`,重 build 套件(`pnpm -F @rfjs/filter-builder build`),再重試。

- [ ] **Step 6:Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "refactor(web/query-builder): consume @rfjs/filter-builder; drop local logic copy"
```

---

## Task 4:全域驗證

- [ ] **Step 1:Build 全部**

Run: `pnpm -w build`
Expected:所有套件 + apps 建置成功(現含 `@rfjs/filter-builder`);web SSG prerender 成功。

- [ ] **Step 2:測試全部**

Run: `pnpm -w test`
Expected:全綠。query-builder 邏輯 spec 現於 `@rfjs/filter-builder` 跑;apps/web 跑其餘。

- [ ] **Step 3:型別檢查觸及的套件**

Run: `pnpm -F @rfjs/filter-builder typecheck && pnpm -F web check-types`
Expected:乾淨。(註:`pnpm -w typecheck` 可能浮出既有、與本案無關的 `orm-app` typecheck 失敗;非本案造成 —— 以 `git diff --name-only origin/main...HEAD` 未觸及任何 orm 檔佐證。)

- [ ] **Step 4:Sanity —— 無殘留參照**

Run: `grep -rn "query-builder/logic/" apps/web/src | grep -v "/logic/colors" || echo "clean — no stray logic imports"`
Expected:`clean`(`logic/` 唯一殘留參照是 `colors`)。

---

## Self-Review(plan 對 spec 覆蓋)

- 新 public 套件 `@rfjs/filter-builder`,鏡像 pg-filter 形狀,deps pg-filter/jsonb-query/data-filter → Task 1 ✅
- 整個 `logic/` 除 `colors.ts` 搬移(含 engines + `toPgGroup` target-tagging + reverse + live-match),spec 一起 → Task 2 ✅
- barrel 涵蓋完整公開面(per-module `export *`) → Task 2 Step 2 ✅
- apps/web:加依賴、重指 ui/ + colors.ts import、刪原檔、`colors.ts` 留下 → Task 3 ✅
- 行為不變的證明 = 搬過去的 spec 在套件全綠 + apps/web vitest/check-types/build/SSG 綠 + 全域 → Task 2–4 ✅
- 風險(import 重指完整性以 web-green 守門;建置順序以 build:packages;barrel 完整性) → 已在 Task 2/3 驗證步驟處理 ✅
- 範圍外(B4-ui、workbench、npm 發布、註冊進 web 型錄) → 計畫未含 ✅
