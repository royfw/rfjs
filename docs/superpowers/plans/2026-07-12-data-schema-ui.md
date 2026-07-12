# `@rfjs/data-schema-ui` 抽取 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 app-level `ProtocolPanel` 升成 package `@rfjs/data-schema-ui`(鏡射 filter-builder-ui),並把純 fetch 的 `makeHttpFetcher` 從 `@rfjs/table-builder-ui` 下沉到 engine `@rfjs/data-schema`。

**Architecture:** 三段搬移:(1) fetcher 下沉 data-schema、table-builder-ui 改 re-export 保 API;(2) 新 package 收 ProtocolPanel(deps 只剩 data-schema + web-ui);(3) apps/web 換 import + transpilePackages + Tailwind `@source`。行為/外觀零變更,由既有測試迴歸。

**Tech Stack:** pnpm workspace / Turborepo、tsdown(data-schema build)、Vitest + @testing-library/react(jsdom)、Next.js 16 transpilePackages、Tailwind v4 `@source`、Changesets。

**Spec:** `docs/superpowers/specs/2026-07-12-data-schema-ui-design.md`

## Global Constraints

- Worktree:`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-data-schema-ui`(branch `feat-data-schema-ui`)。所有指令在此執行。
- Commit 訊息英文(conventional commits),結尾 trailer:`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。
- Changesets(2026-07-12 政策:apps 也要):`@rfjs/data-schema` minor、`@rfjs/table-builder-ui` patch、`@rfjs/data-schema-ui` minor(新 package)、`web` patch。
- **dist 陷阱**:`@rfjs/data-schema` 是 built package(exports → `dist/`)。改它的 src 後,消費端(table-builder-ui、apps/web)要看到新 export 必須 `pnpm -F @rfjs/data-schema build`。
- **Tailwind 陷阱**:transpilePackages 的 package 內 class 需要 `apps/web/src/app/globals.css` 的 `@source` 指到該 package `src`,否則不產 CSS。
- **vitest filter 陷阱**:vitest 4 的 CLI filter 是字面子字串,不要用跳脫的 `\[x\]` 形式。
- 不開 PR、不 push —— 完成後 HOLD,由使用者說「PR」。
- pre-commit hook 會跑 `turbo run lint-staged test --affected`,commit 慢是正常。

---

### Task 0: Worktree setup(一次性)

**Files:** 無(環境準備)。

- [ ] **Step 1: 安裝依賴 + 建 packages dist**

```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-data-schema-ui
pnpm install
pnpm build:packages
```

Expected: install 完成(lockfile 不變)、`packages/data-schema/dist/` 等出現。

- [ ] **Step 2: 基線驗證**

```bash
pnpm -F @rfjs/table-builder-ui test && pnpm -F web test
```

Expected: 全綠(基線;若紅先停,回報)。

---

### Task 1: `makeHttpFetcher` 下沉 `@rfjs/data-schema`,table-builder-ui 改 re-export

**Files:**
- Create: `packages/data-schema/src/http-fetcher.ts`(自 `packages/table-builder-ui/src/http-fetcher.ts` 搬入)
- Create: `packages/data-schema/src/http-fetcher.spec.ts`(自 `packages/table-builder-ui/src/http-fetcher.spec.ts` 搬入)
- Modify: `packages/data-schema/src/index.ts`、`packages/data-schema/tsconfig.json`
- Delete: `packages/table-builder-ui/src/http-fetcher.ts`、`packages/table-builder-ui/src/http-fetcher.spec.ts`
- Modify: `packages/table-builder-ui/src/index.ts`
- Create: `.changeset/http-fetcher-to-data-schema.md`

**Interfaces:**
- Consumes: `RequestMeta`/`BuiltRequest`(`packages/data-schema/src/types.ts:53,88`)。
- Produces: `@rfjs/data-schema` 匯出 `makeHttpFetcher(request: RequestMeta): (built: BuiltRequest) => Promise<unknown>`;`@rfjs/table-builder-ui` 對外 API 不變(re-export)。Task 2 的 ProtocolPanel 會 `import { makeHttpFetcher } from '@rfjs/data-schema'`。

- [ ] **Step 1: 搬 spec(failing test 先行)**

把 `packages/table-builder-ui/src/http-fetcher.spec.ts` **整檔複製**到 `packages/data-schema/src/http-fetcher.spec.ts`,只改兩行 import:

```ts
// 舊(table-builder-ui 內):
import type { RequestMeta } from '@rfjs/data-schema';
import { makeHttpFetcher } from './http-fetcher';
// 新(data-schema 內):
import type { RequestMeta } from './types';
import { makeHttpFetcher } from './http-fetcher';
```

其餘內容原封不動(GET querystring / POST body / 非 2xx throw 三個案例)。

- [ ] **Step 2: 跑測試確認 fail**

```bash
pnpm -F @rfjs/data-schema vitest:run -- http-fetcher
```

Expected: FAIL —— `Cannot find module './http-fetcher'`(或等價 resolve 錯誤)。

- [ ] **Step 3: 搬實作 + 開 DOM lib + 匯出**

3a. 把 `packages/table-builder-ui/src/http-fetcher.ts` **整檔複製**到 `packages/data-schema/src/http-fetcher.ts`,只改第一行 import:

```ts
// 舊:
import type { BuiltRequest, RequestMeta } from '@rfjs/data-schema';
// 新:
import type { BuiltRequest, RequestMeta } from './types';
```

其餘(含 doc comment、GET/POST 邏輯、`query failed: ${res.status}` throw)原封不動。

3b. `packages/data-schema/tsconfig.json` —— `fetch`/`Response`/`URLSearchParams` 需要 DOM 型別:

```jsonc
// 舊:
"lib": ["ESNext"]
// 新:
"lib": ["ESNext", "DOM"]
```

3c. `packages/data-schema/src/index.ts` 末尾加一行:

```ts
export * from './http-fetcher';
```

- [ ] **Step 4: 跑 data-schema 測試 + typecheck,rebuild dist**

```bash
pnpm -F @rfjs/data-schema vitest:run && pnpm -F @rfjs/data-schema typecheck && pnpm -F @rfjs/data-schema build
```

Expected: 測試 PASS(http-fetcher 3 案例 + 既有全綠)、typecheck 乾淨、dist 重建成功。

- [ ] **Step 5: table-builder-ui 刪實作、改 re-export**

5a. 刪 `packages/table-builder-ui/src/http-fetcher.ts` 與 `packages/table-builder-ui/src/http-fetcher.spec.ts`。

5b. `packages/table-builder-ui/src/index.ts`:

```ts
// 舊:
export * from './http-fetcher';
// 新:
export { makeHttpFetcher } from '@rfjs/data-schema';
```

- [ ] **Step 6: 驗 table-builder-ui 與 apps/web 消費端**

```bash
pnpm -F @rfjs/table-builder-ui test && pnpm -F @rfjs/table-builder-ui check-types && pnpm -F web check-types
```

Expected: 全綠(apps/web 的 `import { ConfigTable, makeHttpFetcher } from "@rfjs/table-builder-ui"` 經 re-export 仍成立)。

- [ ] **Step 7: changeset + commit**

Create `.changeset/http-fetcher-to-data-schema.md`:

```md
---
"@rfjs/data-schema": minor
"@rfjs/table-builder-ui": patch
---

Move `makeHttpFetcher` into `@rfjs/data-schema` — the RequestMeta-driven HTTP transport is pure fetch logic and belongs to the engine. `@rfjs/table-builder-ui` re-exports it, so its public API is unchanged.
```

```bash
git add packages/data-schema packages/table-builder-ui .changeset/http-fetcher-to-data-schema.md
git commit -m "refactor(data-schema): sink makeHttpFetcher from table-builder-ui into the engine

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 建立 `packages/data-schema-ui`(ProtocolPanel 進 package)

**Files:**
- Create: `packages/data-schema-ui/package.json`、`tsconfig.json`、`vitest.config.mts`、`README.md`、`README.zh-TW.md`
- Create: `packages/data-schema-ui/src/types.ts`、`src/protocol-panel.tsx`(自 `apps/web/src/components/protocol-panel/index.tsx` 搬入)、`src/protocol-panel.spec.tsx`(自 `.../index.spec.tsx` 搬入)、`src/index.ts`
- Create: `.changeset/data-schema-ui-init.md`

(本 task 不動 apps/web —— 舊元件與新 package 暫時並存,Task 3 才切換。)

**Interfaces:**
- Consumes: Task 1 的 `makeHttpFetcher`(from `@rfjs/data-schema`);`Switch`(`@rfjs/web-ui/components/switch`);`buildRequestParams`/`extractRows` + meta 型別(`@rfjs/data-schema`)。
- Produces: `@rfjs/data-schema-ui` 匯出 `ProtocolPanel`(props `{ request, response, onChange, labels, showEnableToggle? }`)、`DEFAULT_REQUEST: RequestMeta`、`DEFAULT_RESPONSE: ResponseMeta`、`type ProtocolPanelLabels`。Task 3 兩個工具照此 import。

- [ ] **Step 1: package 骨架**

`packages/data-schema-ui/package.json`:

```json
{
  "name": "@rfjs/data-schema-ui",
  "version": "0.0.0",
  "description": "Shared styled protocol editor (React) over @rfjs/data-schema; labels-as-props, consumed via transpilePackages",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest --passWithNoTests --run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "dependencies": {
    "@rfjs/data-schema": "workspace:*",
    "@rfjs/web-ui": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "jsdom": "^29.1.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "typescript": "6.0.3",
    "typescript-eslint": "^8.61.0",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`packages/data-schema-ui/tsconfig.json`(逐字複製 `packages/filter-builder-ui/tsconfig.json`):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

`packages/data-schema-ui/vitest.config.mts`(逐字複製 `packages/filter-builder-ui/vitest.config.mts`):

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.(ts|tsx)'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

然後:

```bash
pnpm install
```

Expected: lockfile 更新,workspace 連結 `@rfjs/data-schema-ui`。

- [ ] **Step 2: 搬 spec(failing test 先行)**

把 `apps/web/src/components/protocol-panel/index.spec.tsx` **整檔複製**到 `packages/data-schema-ui/src/protocol-panel.spec.tsx`,只改一行 import:

```tsx
// 舊:
import { ProtocolPanel } from "./index";
// 新:
import { ProtocolPanel } from "./protocol-panel";
```

(`RequestMeta`/`ResponseMeta` 仍從 `@rfjs/data-schema` import,不變。)

- [ ] **Step 3: 跑測試確認 fail**

```bash
pnpm -F @rfjs/data-schema-ui vitest:run
```

Expected: FAIL —— `Cannot find module './protocol-panel'`。

- [ ] **Step 4: 搬元件 + 拆 labels 型別 + barrel**

4a. `packages/data-schema-ui/src/types.ts` —— 從元件檔把 `ProtocolPanelLabels` interface 整段搬出(欄位一字不改):

```ts
export interface ProtocolPanelLabels {
  enabled: string;
  endpoint: string;
  method: string;
  pagination: string;
  sort: string;
  sortNone: string;
  filter: string;
  filterNone: string;
  filterParam: string;
  rowsPath: string;
  totalPath: string;
  cursorPath: string;
  limitParam: string;
  offsetParam: string;
  pageParam: string;
  pageSizeParam: string;
  firstPage: string;
  cursorParam: string;
  sortParam: string;
  encoding: string;
  fieldParam: string;
  dirParam: string;
  try: string;
  tryRows: string;
  tryError: string;
}
```

4b. 把 `apps/web/src/components/protocol-panel/index.tsx` **整檔複製**到 `packages/data-schema-ui/src/protocol-panel.tsx`,然後只做四處修改(其餘 355 行原封不動):

```tsx
// (i) header import 區塊,舊:
import { Switch } from "@rfjs/web-ui/components/switch";
import { buildRequestParams, extractRows } from "@rfjs/data-schema";
import type { FilterRequestMeta, PaginationMeta, RequestMeta, ResponseMeta, SortMeta } from "@rfjs/data-schema";
import { makeHttpFetcher } from "@rfjs/table-builder-ui";
// 新(fetcher 併入 data-schema import;labels 型別改自 ./types;不再依賴 table-builder-ui):
import { Switch } from "@rfjs/web-ui/components/switch";
import { buildRequestParams, extractRows, makeHttpFetcher } from "@rfjs/data-schema";
import type { FilterRequestMeta, PaginationMeta, RequestMeta, ResponseMeta, SortMeta } from "@rfjs/data-schema";
import type { ProtocolPanelLabels } from "./types";
```

```tsx
// (ii) 刪掉檔內的 `export interface ProtocolPanelLabels { ... }` 整段(已搬到 ./types)。
```

```tsx
// (iii) 兩個預設值加 export(Task 3 之後的消費者與 spec ② 會用):
export const DEFAULT_REQUEST: RequestMeta = { ... };   // 內容不變,只加 export
export const DEFAULT_RESPONSE: ResponseMeta = { ... }; // 內容不變,只加 export
```

```tsx
// (iv) 檔首保留 "use client"; (transpilePackages + App Router 需要)。
```

4c. `packages/data-schema-ui/src/index.ts`:

```ts
export { ProtocolPanel, DEFAULT_REQUEST, DEFAULT_RESPONSE } from './protocol-panel';
export type { ProtocolPanelLabels } from './types';
```

- [ ] **Step 5: 跑測試 + typecheck + lint**

```bash
pnpm -F @rfjs/data-schema-ui vitest:run && pnpm -F @rfjs/data-schema-ui check-types && pnpm -F @rfjs/data-schema-ui lint
```

Expected: 全綠(搬來的 spec 全數 PASS)。

- [ ] **Step 6: README(雙語,鏡射 filter-builder-ui 的簡短風格)**

`packages/data-schema-ui/README.md`:

```md
# @rfjs/data-schema-ui

Shared styled **protocol editor** (React) over
[`@rfjs/data-schema`](../data-schema): edit a `DataResourceMeta`'s
`request`/`response` protocol — endpoint, method, pagination strategy +
params, sort/filter encodings, response paths — with a built-in
"try endpoint" probe (`buildRequestParams` → `makeHttpFetcher` → `extractRows`).

Private workspace package, consumed via Next.js `transpilePackages`
(no build step). Labels are passed as props (`ProtocolPanelLabels`) so
apps keep i18n ownership.

## Usage

```tsx
import { ProtocolPanel, DEFAULT_REQUEST, DEFAULT_RESPONSE } from "@rfjs/data-schema-ui";
import type { ProtocolPanelLabels } from "@rfjs/data-schema-ui";

<ProtocolPanel
  request={request}   // RequestMeta | undefined
  response={response} // ResponseMeta | undefined
  onChange={({ request, response }) => ...}
  labels={labels}     // ProtocolPanelLabels — all strings supplied by the app
  showEnableToggle    // optional, default true — the "declare protocol" switch
/>
```

Sibling of `@rfjs/filter-builder` ↔ `@rfjs/filter-builder-ui`: the engine
(`@rfjs/data-schema`) stays framework-agnostic; this package is the thin
React editor over it.
```

`packages/data-schema-ui/README.zh-TW.md`:

```md
# @rfjs/data-schema-ui

[`@rfjs/data-schema`](../data-schema) 的共用**協定編輯器**(React):
編輯 `DataResourceMeta` 的 `request`/`response` 協定 —— endpoint、method、
分頁策略與參數、排序/篩選編碼、回應路徑 —— 內建「試打 endpoint」
(`buildRequestParams` → `makeHttpFetcher` → `extractRows`)。

私有 workspace package,經 Next.js `transpilePackages` 消費(無 build)。
文案以 props 傳入(`ProtocolPanelLabels`),i18n 由 app 持有。

## 用法

```tsx
import { ProtocolPanel, DEFAULT_REQUEST, DEFAULT_RESPONSE } from "@rfjs/data-schema-ui";
import type { ProtocolPanelLabels } from "@rfjs/data-schema-ui";

<ProtocolPanel
  request={request}   // RequestMeta | undefined
  response={response} // ResponseMeta | undefined
  onChange={({ request, response }) => ...}
  labels={labels}     // ProtocolPanelLabels — 全部字串由 app 提供
  showEnableToggle    // 選配,預設 true —— 「宣告協定」開關
/>
```

與 `@rfjs/filter-builder` ↔ `@rfjs/filter-builder-ui` 同形:engine
(`@rfjs/data-schema`)維持 framework-agnostic,本包是其上的薄 React 編輯層。
```

- [ ] **Step 7: changeset + commit**

Create `.changeset/data-schema-ui-init.md`:

```md
---
"@rfjs/data-schema-ui": minor
---

New package: shared styled ProtocolPanel (React) over @rfjs/data-schema — edits a DataResourceMeta's request/response protocol with a try-endpoint probe; labels-as-props, consumed via transpilePackages. Extracted from apps/web's shared component.
```

```bash
git add packages/data-schema-ui .changeset/data-schema-ui-init.md pnpm-lock.yaml
git commit -m "feat(data-schema-ui): new package — ProtocolPanel extracted from apps/web

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: apps/web 接線(換 import、刪舊件、transpile + @source、web changeset)

**Files:**
- Modify: `apps/web/src/tools/metadata-builder/ui.tsx:11`、`apps/web/src/tools/table-builder/ui.tsx:19`
- Delete: `apps/web/src/components/protocol-panel/`(`index.tsx` + `index.spec.tsx`)
- Modify: `apps/web/next.config.js`、`apps/web/src/app/globals.css`
- Create: `.changeset/web-protocol-panel-package.md`

**Interfaces:**
- Consumes: Task 2 的 `ProtocolPanel` / `type ProtocolPanelLabels`(from `@rfjs/data-schema-ui`)。
- Produces: apps/web 無 app-level protocol-panel;兩工具行為不變。

- [ ] **Step 1: 換兩個工具的 import**

`apps/web/src/tools/metadata-builder/ui.tsx` 與 `apps/web/src/tools/table-builder/ui.tsx`,同一行改法:

```tsx
// 舊:
import { ProtocolPanel, type ProtocolPanelLabels } from "@/components/protocol-panel";
// 新:
import { ProtocolPanel, type ProtocolPanelLabels } from "@rfjs/data-schema-ui";
```

(table-builder `ui.tsx:6` 的 `import { ConfigTable, makeHttpFetcher } from "@rfjs/table-builder-ui";` **不動** —— re-export 仍有效。)

- [ ] **Step 2: 刪舊元件、接 transpile 與 Tailwind**

2a. 刪除整個 `apps/web/src/components/protocol-panel/` 目錄。

2b. `apps/web/next.config.js` 的 `transpilePackages` 陣列加一項(照字母序放 `"@rfjs/bpmn-ui"` 之後):

```js
  transpilePackages: [
    "@rfjs/web-ui",
    "@rfjs/web-core",
    "@rfjs/filter-builder-ui",
    "@rfjs/form-builder-ui",
    "@rfjs/bpmn-ui",
    "@rfjs/data-schema-ui",
    "@rfjs/table-builder-ui",
    "@rfjs/ai-assist-ui",
  ],
```

2c. `apps/web/src/app/globals.css` —— 既有兩行 `@source` 之後加一行,並在註解的 package 列舉補上本包:

```css
@source "../../../../packages/filter-builder-ui/src";
@source "../../../../packages/form-builder-ui/src";
@source "../../../../packages/data-schema-ui/src";
```

(註解第一句的「@rfjs/filter-builder-ui and @rfjs/form-builder-ui」改為「@rfjs/filter-builder-ui, @rfjs/form-builder-ui and @rfjs/data-schema-ui」,其餘不動。)

- [ ] **Step 3: 驗證 apps/web**

```bash
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test
```

Expected: 全綠。metadata-builder / table-builder / source-panel 既有測試(經由工具 ui 渲染 ProtocolPanel)= 迴歸保證;protocol-panel 自身 spec 已隨 Task 2 移入 package。

- [ ] **Step 4: 殘留檢查**

```bash
grep -rn "components/protocol-panel" apps/web/src ; echo "exit=$?"
```

Expected: 無輸出、`exit=1`(零殘留)。

- [ ] **Step 5: changeset + commit**

Create `.changeset/web-protocol-panel-package.md`:

```md
---
"web": patch
---

Consume ProtocolPanel from the new @rfjs/data-schema-ui package; the app-level shared component is removed (import-path-only change for metadata-builder and table-builder).
```

```bash
git add -A apps/web .changeset/web-protocol-panel-package.md
git commit -m "refactor(web): consume ProtocolPanel from @rfjs/data-schema-ui

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 全面驗證 + 截圖(抽取零回歸)

**Files:** 無新增(驗證產物放 scratchpad)。

**Interfaces:** Consumes: Tasks 1–3 全部;Produces: 驗證報告 + 截圖(與 #249 外觀一致的證據)。

- [ ] **Step 1: 四個 workspace 的測試/型別全跑**

```bash
pnpm -F @rfjs/data-schema test && pnpm -F @rfjs/data-schema typecheck
pnpm -F @rfjs/table-builder-ui test && pnpm -F @rfjs/table-builder-ui check-types
pnpm -F @rfjs/data-schema-ui test && pnpm -F @rfjs/data-schema-ui check-types
pnpm -F web test && pnpm -F web check-types && pnpm -F web lint
```

Expected: 全綠。

- [ ] **Step 2: dev server + 截圖**

```bash
# 清掉 3170 埠上可能的殘留 server(只 kill 該埠 pid,勿 pkill -f)
lsof -ti :3170 | xargs -r kill
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-data-schema-ui
pnpm --dir apps/web exec next dev --port 3170 &
```

等 ready 後,用 playwright-core 截圖腳本(bundled chromium `/home/royfw/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`;`import pw from '...playwright-core/index.js'; const { chromium } = pw;` —— CJS 套件):

1. `http://localhost:3170/en/tools/metadata-builder` → 協定區(含 Try endpoint 按鈕)截圖。
2. `http://localhost:3170/en/tools/table-builder` → 點 `Remote` → 內嵌協定編輯器截圖。

Expected: 兩畫面與 #249 merge 時外觀一致(欄位齊、樣式無缺 —— 若 class 掉了= `@source` 沒生效,回 Task 3 Step 2c 檢查)。截圖存 scratchpad,截完 kill dev server。

- [ ] **Step 3: 分支總結**

```bash
git log --oneline main..HEAD && git status
```

Expected: 3 個 commits(Task 1/2/3)+ 乾淨 working tree。**HOLD —— 不開 PR**,回報使用者。

---

## Self-Review(已跑)

- **Spec coverage**:變更清單 1(Task 1)、2(Task 2)、3(Task 3,含 spec 後補的 `@source`)、4 changesets(各 task 內含 + web patch)、驗收四條(Task 4 + 各 task step)。✓
- **Placeholder scan**:無 TBD/TODO;搬檔步驟以「整檔複製 + 精確 diff」表達,無「similar to」引用。✓
- **Type consistency**:`makeHttpFetcher(request: RequestMeta): (built: BuiltRequest) => Promise<unknown>` 與 `ProtocolPanel` props 簽名在 Task 1/2/3 一致;`ProtocolPanelLabels` 欄位集與現檔一致(25 欄)。✓
