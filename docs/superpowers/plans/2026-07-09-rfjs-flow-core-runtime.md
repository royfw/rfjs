# @rfjs/flow-core Flow Phase 2 Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽出可發布的 `@rfjs/flow-core`(搬入既有 FlowDoc schema + projection,新增純函式 runtime + resolveCondition helper),app 的 flow-builder 改為消費它,行為不變。

**Architecture:** `packages/flow-core` publishable engine。核心零依賴(schema/projection/runtime,只用 zod);`condition.ts` 依賴 `@rfjs/data-filter`。runtime 是純狀態機 `advance(doc, state, event) → nextState`,推進到需要外部輸入的節點就暫停;副作用/時間/持久化全交消費端。

**Tech Stack:** TypeScript、zod、tsdown、vitest、`@rfjs/data-filter`(resolveCondition)。

**Spec:** `docs/superpowers/specs/2026-07-09-rfjs-flow-core-runtime-design.md`

## Global Constraints

- 新 publishable 套件 `@rfjs/flow-core`(`packages/flow-core`),鏡像既有 publishable 套件慣例(範本:`packages/retry` 的 package.json / tsdown.config.ts / vitest.config.mts / tsconfig.json / tsconfig.build.json / README + README.zh-TW.md)。**附 changeset**(`@rfjs/flow-core` minor)。
- **搬檔行為不變**:`schema.ts` / `projection.ts` 逐字搬入套件,內容不改;app flow-builder 內原本 `from "./schema"` / `from "./projection"` 的檔案改成 `from "@rfjs/flow-core"`。安全網 = 既有 flow-builder 測試全綠。
- runtime 純函式、零 IO/時鐘/React;錯誤丟具名 `FlowError`(kind: `wrong-event`|`no-edge`|`unknown-handle`|`no-path`)。
- 契約凍結(spec §3):`FlowState{at,status,awaiting,options?,context}`、`FlowEvent(submit|decide|complete|fail|timeout)`、`startFlow`、`advance`、`resolveCondition`。
- app 消費經 Next.js `transpilePackages`(同 filter-builder 慣例)。
- commit 英文 conventional(subject 全小寫,trailer 前空行,最後一行恰為 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`)。
- 驗證指令:套件 `pnpm --filter @rfjs/flow-core vitest:run` / `build` / `typecheck` / `lint`;app `pnpm --filter web vitest:run` / `check-types` / `lint`;整合 `pnpm --filter web build` + `pnpm --filter workbench build`。
- 開工前 `git fetch` 對齊最新 origin/main。平行 session 在 feat-api-filter(table/api),區域不重疊。

**既有事實(controller 查核)**:
- FlowDoc schema(`apps/web/src/tools/flow-builder/schema.ts`):`FlowNode{id,type,position,config?,inputs?,outputCollection?}`,`type ∈ {start,end,form,condition,action}`;`FlowEdge{id,source,target,sourceHandle?,label?,trigger?,condition?}`;`FlowDoc{version:1,nodes,edges}`;含 `emptyFlow()`/`parseFlow(json)`/`flowToJson(doc)`。
- `projection.ts`:純,僅 `import type {...} from "./schema"`,export `ProjectOptions` + `projectFlow(doc, options)`。
- `@rfjs/data-filter` 公開:`matchQueryAsync(data, filterQuery, options?): Promise<boolean>`、型別 `FilterMatchQuery = { logic, filters:(MatchQueryMetadata|FilterMatchQuery)[] }`、`ObjectData`。（resolveCondition 用 async 版。）
- 要 repoint 的 app 檔(import `./schema` 或 `./projection`):`bpmn.ts`、`bpmn.spec.ts`、`model.ts`、`model.spec.ts`、`ui.tsx`、`nodes.tsx`、`bpmn-view.tsx`、`sample.ts`（`schema.spec.ts`/`projection.spec.ts` 隨檔搬入套件)。
- 範本套件 `@rfjs/retry` 的 tsconfig 有 `strict` + `noUnusedLocals` + `isolatedModules`。

---

### Task 1: scaffold `@rfjs/flow-core` + 搬入 schema

**Files:**
- Create: `packages/flow-core/package.json`、`tsdown.config.ts`、`vitest.config.mts`、`tsconfig.json`、`tsconfig.build.json`、`eslint.config.mjs`、`src/index.ts`
- Move: `apps/web/src/tools/flow-builder/schema.ts` → `packages/flow-core/src/schema.ts`(內容不改);`schema.spec.ts` → `packages/flow-core/src/schema.spec.ts`
- Test: 隨 schema.spec.ts 搬入

**Interfaces:**
- Produces:`@rfjs/flow-core` 從 `src/index.ts` re-export schema 全部(`FlowDoc`/`FlowNode`/`FlowEdge`/`FlowNodeType`/`emptyFlow`/`parseFlow`/`flowToJson` + zod schemas)。

- [ ] **Step 1: 建套件骨架** — 複製 `packages/retry` 的六個設定檔到 `packages/flow-core`,改 `package.json`:

```json
{
  "name": "@rfjs/flow-core",
  "version": "0.0.0",
  "description": "Framework-agnostic flow document contract + pure state-machine runtime for approval/workflow flows",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.mjs", "require": "./dist/index.js" } },
  "sideEffects": false,
  "private": false,
  "publishConfig": { "access": "public" },
  "scripts": {
    "clean": "pnpm exec npm-run-all --parallel clean:dist clean:types",
    "clean:types": "pnpm exec rimraf ./types",
    "clean:dist": "pnpm exec rimraf ./dist",
    "build": "pnpm run build:tsdown",
    "build:tsdown": "pnpm run clean && tsdown --config-loader unrun",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "pnpm run vitest:run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "author": "Roy Chuang",
  "license": "ISC",
  "repository": { "type": "git", "url": "git+https://github.com/royfw/rfjs.git", "directory": "packages/flow-core" },
  "files": ["dist", "README.md", "README.zh-TW.md"],
  "dependencies": { "zod": "^3.24.1" },
  "devDependencies": {
    "@eslint/js": "^9.20.0", "@types/node": "^25.9.1", "@vitest/coverage-istanbul": "^3.2.3",
    "eslint": "^9.20.1", "eslint-config-prettier": "^10.0.1", "npm-run-all": "^4.1.5",
    "prettier": "^3.5.1", "rimraf": "^6.0.1", "tsdown": "0.17.0-beta.6",
    "typescript": "^5.7.3", "typescript-eslint": "^8.24.0", "vitest": "^3.2.3"
  }
}
```
`tsdown.config.ts` / `vitest.config.mts` / `tsconfig.json` / `tsconfig.build.json` / `eslint.config.mjs` 逐字沿用 retry 版(zod 版本以 monorepo 現行為準:先 `grep '"zod"' packages/data-filter/package.json` 對齊)。

- [ ] **Step 2: 搬 schema** — `git mv apps/web/src/tools/flow-builder/schema.ts packages/flow-core/src/schema.ts` 與 `schema.spec.ts` 同理。內容**不改**。
- [ ] **Step 3: barrel** — `packages/flow-core/src/index.ts`:

```ts
export * from "./schema";
```

- [ ] **Step 4: 裝相依 + 驗證** — `pnpm install`(讓 workspace 認得新套件)後:

```
pnpm --filter @rfjs/flow-core vitest:run     # schema.spec 全綠
pnpm --filter @rfjs/flow-core build          # tsdown 產 dist
pnpm --filter @rfjs/flow-core typecheck      # 乾淨
pnpm --filter @rfjs/flow-core lint           # 乾淨
```
Expected:schema 測試通過、dist 產出、type/lint 乾淨。(此時 app 會因 schema.ts 被搬走而壞 —— Task 3 修;本 task 不跑 app。)

- [ ] **Step 5: Commit**

```bash
git add packages/flow-core apps/web/src/tools/flow-builder/
git commit -m "feat(flow-core): scaffold package and move flowdoc schema in"
```

---

### Task 2: 搬入 projection

**Files:**
- Move: `apps/web/src/tools/flow-builder/projection.ts` → `packages/flow-core/src/projection.ts`;`projection.spec.ts` → `packages/flow-core/src/projection.spec.ts`
- Modify: `packages/flow-core/src/projection.ts`(import `./schema` 路徑不變,同套件內);`packages/flow-core/src/index.ts`

**Interfaces:**
- Produces:`@rfjs/flow-core` 多 export `projectFlow`/`ProjectOptions`。

- [ ] **Step 1: 搬檔** — `git mv` projection.ts + projection.spec.ts 進 `packages/flow-core/src/`。`projection.ts` 內 `from "./schema"` 路徑**不變**(同資料夾);`projection.spec.ts` 若 import `./schema`/`./projection` 也不變。
- [ ] **Step 2: barrel** — index.ts 追加:

```ts
export * from "./projection";
```

- [ ] **Step 3: 驗證** — `pnpm --filter @rfjs/flow-core vitest:run`(schema + projection 測試全綠)+ `build` + `typecheck` + `lint`。
- [ ] **Step 4: Commit**

```bash
git add packages/flow-core apps/web/src/tools/flow-builder/
git commit -m "feat(flow-core): move flow projection into the package"
```

---

### Task 3: app 消費 `@rfjs/flow-core`(repoint + 刪搬走的檔)

**Files:**
- Modify: `apps/web/package.json`(加 `"@rfjs/flow-core": "workspace:*"` 依賴)
- Modify: `apps/web/next.config.*`(`transpilePackages` 加 `@rfjs/flow-core`)
- Modify(import repoint,`./schema`|`./projection` → `@rfjs/flow-core`):`apps/web/src/tools/flow-builder/` 的 `bpmn.ts`、`bpmn.spec.ts`、`model.ts`、`model.spec.ts`、`ui.tsx`、`nodes.tsx`、`bpmn-view.tsx`、`sample.ts`
- Delete:(schema.ts/projection.ts 已於 T1/T2 `git mv` 移走 —— 確認 app 內不再有殘留)

**Interfaces:**
- Consumes:`@rfjs/flow-core`(T1/T2)。
- Produces:無(app 端消費)。

- [ ] **Step 1: 加依賴 + transpilePackages** — `apps/web/package.json` 的 `dependencies` 加 `"@rfjs/flow-core": "workspace:*"`;`next.config` 的 `transpilePackages` 陣列加 `"@rfjs/flow-core"`(照既有 `@rfjs/filter-builder` 那行的形式)。`pnpm install`。
- [ ] **Step 2: repoint imports** — 上列 8 個檔,把 `from "./schema"` 與 `from "./projection"` 改成 `from "@rfjs/flow-core"`。**先 grep 確認每個檔實際 import 了什麼**(型別 vs 值),整合成單一 `@rfjs/flow-core` import。逐檔做,勿漏。
- [ ] **Step 3: 確認無殘留** — `grep -rn '"\./schema"\|"\./projection"\|'\''\./schema'\''\|'\''\./projection'\''' apps/web/src/tools/flow-builder/` 應為空;`ls apps/web/src/tools/flow-builder/schema.ts apps/web/src/tools/flow-builder/projection.ts` 應不存在。
- [ ] **Step 4: 全套驗證(headline gate —— 行為不變)**

```
pnpm --filter web vitest:run     # flow-builder 工具測試全綠(schema/projection 除外,已搬走)
pnpm --filter web check-types    # 乾淨
pnpm --filter web lint           # 乾淨
```
Expected:全綠。app 的 flow-builder 行為與搬檔前完全一致。

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): consume @rfjs/flow-core for flowdoc schema and projection"
```

---

### Task 4: runtime.ts —— startFlow / advance / FlowError

**Files:**
- Create: `packages/flow-core/src/runtime.ts`、`packages/flow-core/src/runtime.spec.ts`
- Modify: `packages/flow-core/src/index.ts`(export runtime)

**Interfaces:**
- Consumes:`FlowDoc`/`FlowNode`/`FlowEdge`(同套件 `./schema`)。
- Produces:`FlowState`/`FlowEvent`/`FlowError`/`startFlow`/`advance`(見下)。

- [ ] **Step 1: 寫失敗測試** — `runtime.spec.ts`(用 spec §3 的請假流 fixture;涵蓋 startFlow、每種事件轉換、timeout、條件式 timeout 落地、所有 FlowError):

```ts
import { describe, expect, it } from "vitest";
import type { FlowDoc } from "./schema";
import { startFlow, advance, FlowError } from "./runtime";

// 請假流:start → form → condition(yes/no)→ action → end;approver form 另有 timeout 邊 → esc(condition)
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 0, y: 0 } },
    { id: "cond1", type: "condition", position: { x: 0, y: 0 } },
    { id: "act1", type: "action", position: { x: 0, y: 0 } },
    { id: "act2", type: "action", position: { x: 0, y: 0 } },
    { id: "esc", type: "condition", position: { x: 0, y: 0 } },
    { id: "end", type: "end", position: { x: 0, y: 0 } },
  ],
  edges: [
    { id: "e0", source: "start", target: "form1" },
    { id: "e1", source: "form1", target: "cond1", trigger: "onSubmit" },
    { id: "et", source: "form1", target: "esc", trigger: "timeout" },
    { id: "e2", source: "cond1", target: "act1", sourceHandle: "yes" },
    { id: "e3", source: "cond1", target: "act2", sourceHandle: "no" },
    { id: "e4", source: "act1", target: "end" },
    { id: "e5", source: "act2", target: "end" },
    { id: "e6", source: "esc", target: "end", sourceHandle: "auto" },
  ],
};

describe("startFlow", () => {
  it("進 start、自動推進到第一個 block 節點(form)", () => {
    const s = startFlow(doc);
    expect(s).toMatchObject({ at: "form1", status: "running", awaiting: "submit" });
    expect(s.context).toEqual({});
  });
  it("start 無出邊 → FlowError no-edge", () => {
    const bad: FlowDoc = { version: 1, nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 } }], edges: [] };
    expect(() => startFlow(bad)).toThrow(FlowError);
    try { startFlow(bad); } catch (e) { expect((e as FlowError).kind).toBe("no-edge"); }
  });
  it("無 start 節點 → FlowError no-path", () => {
    const bad: FlowDoc = { version: 1, nodes: [{ id: "end", type: "end", position: { x: 0, y: 0 } }], edges: [] };
    try { startFlow(bad); } catch (e) { expect((e as FlowError).kind).toBe("no-path"); }
  });
});

describe("advance —— 正常路徑", () => {
  it("submit 併資料、推進到 condition 並列出 options", () => {
    let s = startFlow(doc);
    s = advance(doc, s, { type: "submit", data: { days: 5 } });
    expect(s).toMatchObject({ at: "cond1", awaiting: "decision" });
    expect(s.options).toEqual(["yes", "no"]);
    expect(s.context).toEqual({ days: 5 });
  });
  it("decide 走對應 handle 到 action", () => {
    let s = advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: { days: 5 } }, { type: "decide", handle: "no" });
    expect(s).toMatchObject({ at: "act2", awaiting: "action" });
  });
  it("complete 併 result、走到 end done", () => {
    const s = advance(doc, { at: "act2", status: "running", awaiting: "action", context: { days: 5 } }, { type: "complete", result: { ticket: "T-1" } });
    expect(s).toMatchObject({ at: "end", status: "done", awaiting: null });
    expect(s.context).toEqual({ days: 5, ticket: "T-1" });
  });
});

describe("advance —— action fail", () => {
  it("fail → status failed、__error 存入 context", () => {
    const s = advance(doc, { at: "act1", status: "running", awaiting: "action", context: {} }, { type: "fail", error: "boom" });
    expect(s).toMatchObject({ at: "act1", status: "failed", awaiting: null });
    expect(s.context.__error).toBe("boom");
  });
});

describe("advance —— timeout(含條件式)", () => {
  it("form 節點 timeout 走 trigger:timeout 邊,落在 condition(條件式 timeout)", () => {
    const s = advance(doc, { at: "form1", status: "running", awaiting: "submit", context: {} }, { type: "timeout" });
    expect(s).toMatchObject({ at: "esc", awaiting: "decision" });
    expect(s.options).toEqual(["auto"]);
  });
  it("節點無 timeout 邊 → FlowError no-edge", () => {
    // act1 無 timeout 邊
    try { advance(doc, { at: "act1", status: "running", awaiting: "action", context: {} }, { type: "timeout" }); }
    catch (e) { expect((e as FlowError).kind).toBe("no-edge"); }
  });
});

describe("advance —— 錯誤", () => {
  it("wrong-event:awaiting decision 卻餵 submit", () => {
    try { advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: {} }, { type: "submit", data: {} }); }
    catch (e) { expect((e as FlowError).kind).toBe("wrong-event"); }
  });
  it("unknown-handle:decide 給不存在的 handle", () => {
    try { advance(doc, { at: "cond1", status: "running", awaiting: "decision", context: {} }, { type: "decide", handle: "maybe" }); }
    catch (e) { expect((e as FlowError).kind).toBe("unknown-handle"); }
  });
  it("已結束的流程再 advance → wrong-event", () => {
    try { advance(doc, { at: "end", status: "done", awaiting: null, context: {} }, { type: "submit", data: {} }); }
    catch (e) { expect((e as FlowError).kind).toBe("wrong-event"); }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗** — `pnpm --filter @rfjs/flow-core vitest:run` → FAIL(runtime 不存在)。
- [ ] **Step 3: 實作** — `packages/flow-core/src/runtime.ts`:

```ts
import type { FlowDoc, FlowEdge, FlowNode } from "./schema";

export type FlowAwaiting = "submit" | "decision" | "action" | null;
export type FlowStatus = "running" | "done" | "failed";

export interface FlowState {
  at: string;
  status: FlowStatus;
  awaiting: FlowAwaiting;
  options?: string[];
  context: Record<string, unknown>;
}

export type FlowEvent =
  | { type: "submit"; data: Record<string, unknown> }
  | { type: "decide"; handle: string }
  | { type: "complete"; result?: Record<string, unknown> }
  | { type: "fail"; error?: unknown }
  | { type: "timeout" };

export type FlowErrorKind = "wrong-event" | "no-edge" | "unknown-handle" | "no-path";

export class FlowError extends Error {
  constructor(
    public readonly kind: FlowErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "FlowError";
  }
}

const nodeById = (doc: FlowDoc, id: string): FlowNode => {
  const n = doc.nodes.find((x) => x.id === id);
  if (!n) throw new FlowError("no-path", `node not found: ${id}`);
  return n;
};

const outEdges = (doc: FlowDoc, id: string): FlowEdge[] => doc.edges.filter((e) => e.source === id);

/** 依節點型別給 awaiting;start/end 為 null。 */
function awaitingFor(type: FlowNode["type"]): FlowAwaiting {
  if (type === "form") return "submit";
  if (type === "condition") return "decision";
  if (type === "action") return "action";
  return null;
}

/** 到達 nodeId,計算落地狀態。 */
function land(doc: FlowDoc, nodeId: string, context: Record<string, unknown>): FlowState {
  const node = nodeById(doc, nodeId);
  if (node.type === "end") return { at: nodeId, status: "done", awaiting: null, context };
  const state: FlowState = { at: nodeId, status: "running", awaiting: awaitingFor(node.type), context };
  if (node.type === "condition") {
    state.options = outEdges(doc, nodeId)
      .map((e) => e.sourceHandle)
      .filter((h): h is string => typeof h === "string");
  }
  return state;
}

/** 唯一「正常」(非 timeout)出邊的目標。 */
function normalTarget(doc: FlowDoc, id: string): string {
  const edges = outEdges(doc, id).filter((e) => e.trigger !== "timeout");
  if (edges.length !== 1) {
    throw new FlowError("no-edge", `expected exactly one non-timeout out-edge from ${id}, got ${edges.length}`);
  }
  return edges[0]!.target;
}

function timeoutTarget(doc: FlowDoc, id: string): string {
  const edge = outEdges(doc, id).find((e) => e.trigger === "timeout");
  if (!edge) throw new FlowError("no-edge", `no timeout out-edge from ${id}`);
  return edge.target;
}

/** 進入流程:定位 start,沿其正常出邊推進到第一個 block 節點。 */
export function startFlow(doc: FlowDoc): FlowState {
  const start = doc.nodes.find((n) => n.type === "start");
  if (!start) throw new FlowError("no-path", "no start node");
  return land(doc, normalTarget(doc, start.id), {});
}

/** 走一步:事件須配得上目前節點,否則丟 FlowError。 */
export function advance(doc: FlowDoc, state: FlowState, event: FlowEvent): FlowState {
  if (state.status !== "running") throw new FlowError("wrong-event", `flow is ${state.status}`);
  const node = nodeById(doc, state.at);
  const ctx = state.context;

  switch (event.type) {
    case "submit":
      if (node.type !== "form") throw new FlowError("wrong-event", `submit at ${node.type}`);
      return land(doc, normalTarget(doc, node.id), { ...ctx, ...event.data });
    case "complete":
      if (node.type !== "action") throw new FlowError("wrong-event", `complete at ${node.type}`);
      return land(doc, normalTarget(doc, node.id), { ...ctx, ...(event.result ?? {}) });
    case "fail":
      if (node.type !== "action") throw new FlowError("wrong-event", `fail at ${node.type}`);
      return { at: node.id, status: "failed", awaiting: null, context: { ...ctx, __error: event.error } };
    case "decide": {
      if (node.type !== "condition") throw new FlowError("wrong-event", `decide at ${node.type}`);
      const edge = outEdges(doc, node.id).find((e) => e.sourceHandle === event.handle);
      if (!edge) throw new FlowError("unknown-handle", `no edge for handle ${event.handle} at ${node.id}`);
      return land(doc, edge.target, ctx);
    }
    case "timeout":
      if (node.type !== "form" && node.type !== "action") throw new FlowError("wrong-event", `timeout at ${node.type}`);
      return land(doc, timeoutTarget(doc, node.id), ctx);
  }
}
```

- [ ] **Step 4: barrel** — index.ts 追加 `export * from "./runtime";`
- [ ] **Step 5: 跑測試確認通過** — `pnpm --filter @rfjs/flow-core vitest:run` 全綠 + `typecheck` + `lint`。
- [ ] **Step 6: Commit**

```bash
git add packages/flow-core
git commit -m "feat(flow-core): add pure state-machine runtime with timeout routing"
```

---

### Task 5: condition.ts —— resolveCondition / resolveHandle

**Files:**
- Create: `packages/flow-core/src/condition.ts`、`packages/flow-core/src/condition.spec.ts`
- Modify: `packages/flow-core/src/index.ts`;`packages/flow-core/package.json`(加 `@rfjs/data-filter` 依賴)

**Interfaces:**
- Consumes:`@rfjs/data-filter`(`matchQueryAsync`/`FilterMatchQuery`)、`FlowEdge`/`FlowDoc`(`./schema`)。
- Produces:`resolveCondition(edge, context): Promise<boolean>`;`resolveHandle(doc, nodeId, context): Promise<string | null>`(挑第一個 condition 成立的 sourceHandle,消費端便利)。

- [ ] **Step 1: 加依賴** — `packages/flow-core/package.json` 的 `dependencies` 加 `"@rfjs/data-filter": "workspace:*"`。`pnpm install`。
- [ ] **Step 2: 寫失敗測試** — `condition.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FlowDoc } from "./schema";
import { resolveCondition, resolveHandle } from "./condition";

// data-filter 的 FilterMatchQuery 形狀(以其型別為準):{ logic, filters:[{ path, dataType, operator, value }] }
const gt3 = { logic: "and", filters: [{ path: "days", dataType: "numeric", operator: "gt", value: 3 }] };

const doc: FlowDoc = {
  version: 1,
  nodes: [{ id: "cond1", type: "condition", position: { x: 0, y: 0 } }],
  edges: [
    { id: "e2", source: "cond1", target: "a", sourceHandle: "yes", condition: gt3 },
    { id: "e3", source: "cond1", target: "b", sourceHandle: "no" },
  ],
};

describe("resolveCondition", () => {
  it("context 符合 → true", async () => {
    expect(await resolveCondition(doc.edges[0]!, { days: 5 })).toBe(true);
  });
  it("context 不符 → false", async () => {
    expect(await resolveCondition(doc.edges[0]!, { days: 2 })).toBe(false);
  });
});

describe("resolveHandle", () => {
  it("挑第一個 condition 成立的 sourceHandle", async () => {
    expect(await resolveHandle(doc, "cond1", { days: 5 })).toBe("yes");
  });
  it("都不成立(且無無條件邊)→ null", async () => {
    expect(await resolveHandle(doc, "cond1", { days: 2 })).toBe(null);
  });
});
```
(實作前先 `grep` `@rfjs/data-filter` 的 `FilterMatchQuery`/`MatchQueryMetadata` 實際欄位名,fixture 以真型別為準 —— 上面 `path/dataType/operator/value` 需核對。)

- [ ] **Step 3: 確認失敗後實作** — `packages/flow-core/src/condition.ts`:

```ts
import { matchQueryAsync, type FilterMatchQuery, type ObjectData } from "@rfjs/data-filter";
import type { FlowDoc, FlowEdge } from "./schema";

/** 用 @rfjs/data-filter 對 context 評估 edge.condition;無 condition 視為恆真。 */
export async function resolveCondition(edge: FlowEdge, context: Record<string, unknown>): Promise<boolean> {
  if (edge.condition == null) return true;
  return matchQueryAsync(context as ObjectData, edge.condition as FilterMatchQuery);
}

/** 便利:對某 condition 節點的出邊依序評估,回第一個成立的 sourceHandle;都不成立回 null。
 * 無 condition 的邊視為恆真(可當 default/fallback)。 */
export async function resolveHandle(
  doc: FlowDoc,
  nodeId: string,
  context: Record<string, unknown>,
): Promise<string | null> {
  for (const edge of doc.edges.filter((e) => e.source === nodeId)) {
    if (typeof edge.sourceHandle !== "string") continue;
    if (await resolveCondition(edge, context)) return edge.sourceHandle;
  }
  return null;
}
```

- [ ] **Step 4: barrel** — index.ts 追加 `export * from "./condition";`
- [ ] **Step 5: 驗證** — `pnpm --filter @rfjs/flow-core vitest:run` 全綠 + `build`(確認 data-filter dep 可 bundle)+ `typecheck` + `lint`。
- [ ] **Step 6: Commit**

```bash
git add packages/flow-core
git commit -m "feat(flow-core): add resolveCondition and resolveHandle over data-filter"
```

---

### Task 6: README 雙語 + changeset + 完整 gates

**Files:**
- Create: `packages/flow-core/README.md`、`packages/flow-core/README.zh-TW.md`、`.changeset/flow-core-init.md`

**Interfaces:** 收尾,無新介面。

- [ ] **Step 1: README(雙語)** — 依既有 `@rfjs/*` README 風格:定位、安裝、FlowDoc + runtime 快速範例(startFlow → advance 一遍 + timeout/條件式 timeout + resolveHandle)、契約表、非目標。內容對齊 spec。
- [ ] **Step 2: changeset**

```md
---
"@rfjs/flow-core": minor
---

Flow Phase 2 minimal runtime: publishable @rfjs/flow-core with the FlowDoc contract, pure projection, a pure state-machine runtime (startFlow/advance with submit/decide/complete/fail/timeout events, named FlowError), and resolveCondition/resolveHandle over @rfjs/data-filter. apps/web flow-builder now consumes it.
```

- [ ] **Step 3: 完整 gates(全綠)**

```
pnpm --filter @rfjs/flow-core vitest:run
pnpm --filter @rfjs/flow-core build
pnpm --filter @rfjs/flow-core typecheck
pnpm --filter @rfjs/flow-core lint
pnpm --filter web vitest:run
pnpm --filter web check-types
pnpm --filter web lint
pnpm --filter web build
pnpm --filter workbench build
```
Expected:全綠。flow-builder e2e 不受影響(runtime 不碰 UI),本案不新增 e2e。

- [ ] **Step 4: Commit**

```bash
git add packages/flow-core .changeset
git commit -m "docs(flow-core): bilingual readme and changeset"
```

---

## Self-Review(已跑)

1. **Spec 覆蓋**:套件抽離+schema/projection 搬入(T1/T2)、app repoint 行為不變(T3)、runtime 契約 startFlow/advance/FlowError + submit/decide/complete/fail/timeout + 條件式 timeout(T4)、resolveCondition/resolveHandle 接 data-filter(T5)、README+changeset+gates(T6)。§7 defer 項不實作。無缺口。
2. **Placeholder 掃描**:無 TBD。fixture 的 data-filter 欄位名(path/dataType/operator/value)標明「實作前核對真型別」—— 這是對既有型別的求證,非 placeholder(型別在 repo 內可讀)。
3. **型別一致**:`FlowState`/`FlowEvent`/`FlowError`(T4)= T5/README 引用;`awaitingFor`/`land`/`normalTarget`/`timeoutTarget` 私有輔助一致;`resolveCondition` async 回 `Promise<boolean>`(對齊 data-filter `matchQueryAsync` 是 async)—— T5 測試用 `await`,一致。runtime 的 `end`→done、condition→options 落地規則與 spec §3 一致。
