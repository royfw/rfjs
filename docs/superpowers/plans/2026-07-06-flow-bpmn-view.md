# flow-builder BPMN 檢視 / 匯出 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** flow-builder 新增「BPMN」分頁(FlowDoc → BPMN 2.0 XML 單向編譯 + `@rfjs/bpmn-ui` 檢視 + 投影切換 + 下載 `.bpmn`),並收掉 nodes.tsx 標籤 i18n、model.ts nodeSeq 兩個 minors。

**Architecture:** FlowDoc 是唯一真相;`projection.ts` / `bpmn.ts` 是零依賴純函式,UI 層 `bpmn-view.tsx` 只做「編譯結果餵給唯讀 viewer」。詳細規格見 `docs/superpowers/specs/2026-07-06-flow-bpmn-view-design.md`(**每個任務開工前先讀 spec 對應章節**)。

**Tech Stack:** Next.js(apps/web)、vitest + testing-library、`@rfjs/bpmn-ui`(NavigatedViewer wrapper)、Playwright e2e(port 3002)。

## Global Constraints

- 工作目錄:worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-flow-bpmn-view`,分支 `feat-flow-bpmn-view`。
- **並行紅線 — 絕對不碰**:`packages/web-core/src/registry/{tools,packages}.ts`、`apps/web/src/tools/{index,messages}.ts`、`apps/web/src/tools/index.spec.ts`、`apps/web/next.config.js`、`apps/web/package.json`。變更僅限 `apps/web/src/tools/flow-builder/**` 與 `apps/web/e2e/flow-builder.e2e.ts`。
- Commit:英文 conventional commits,subject 全小寫開頭,結尾附 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 無 changeset(全屬 private 的 apps/web)。
- 測試指令:`pnpm -F web vitest:run <檔案路徑>`(在 worktree 根目錄執行)。
- i18n placeholder 一律 `t("key", { 值 })`,不 raw retrieve(next-intl raw 取含 `{}` 訊息會 runtime 炸)。
- `pnpm build:packages` 已在 worktree 跑過;若遇到 `@rfjs/*` 解析錯誤先重跑它再判斷。

---

### Task 1: `model.ts` nodeSeq → `nextNodeId` 純函式(minor)

**Files:**
- Modify: `apps/web/src/tools/flow-builder/model.ts:106-115`
- Modify: `apps/web/src/tools/flow-builder/model.spec.ts:28-34`
- Modify: `apps/web/src/tools/flow-builder/ui.tsx:67-70`(呼叫端)

**Interfaces:**
- Produces: `nextNodeId(type: FlowNodeType, existingIds: string[]): string`;`newNode(type: FlowNodeType, position: { x: number; y: number }, existingIds: string[] = []): RFNode`(第三參數新增,預設 `[]`)。

- [ ] **Step 1: 寫失敗測試** — `model.spec.ts` 新增 describe,並改寫既有 `newNode` 測試(語意不變:連續新增 id 唯一):

```ts
import { toReactFlow, toFlowDoc, newNode, nextNodeId, defaultConfig, findFreePosition } from "./model";

describe("nextNodeId", () => {
  it("starts at 1 on an empty canvas", () => {
    expect(nextNodeId("action", [])).toBe("action-1");
  });

  it("continues after the max existing number of the same type", () => {
    expect(nextNodeId("action", ["action-2", "action-7", "form-9"])).toBe("action-8");
  });

  it("ignores other types and non-matching id formats", () => {
    // sample 的 "act-1"、自由命名的 "action-x" 都不符合 ^action-\d+$,不干擾編號
    expect(nextNodeId("action", ["act-1", "action-x", "start", "form-3"])).toBe("action-1");
  });
});
```

既有 `newNode` 測試(`model.spec.ts:28-34`)改為:

```ts
  it("newNode gives a typed node with default config and a unique id", () => {
    const a = newNode("action", { x: 1, y: 1 });
    const b = newNode("action", { x: 2, y: 2 }, [a.id]);
    expect(a.type).toBe("action");
    expect((a.data as { config: unknown }).config).toEqual({ kind: "notify", params: {} });
    expect(a.id).not.toBe(b.id);
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/model.spec.ts`
Expected: FAIL —— `nextNodeId is not a function`(或 import 錯誤)。

- [ ] **Step 3: 實作** — `model.ts` 把 `let nodeSeq = 0;` 與舊 `newNode` 整段(106-115 行)換成:

```ts
/** 由既有 id 推導下一個同型別編號(純函式;只跟 `type-N` 格式的同型別 id 比,必不撞名)。 */
export function nextNodeId(type: FlowNodeType, existingIds: string[]): string {
  const re = new RegExp(`^${type}-(\\d+)$`);
  const max = existingIds.reduce((m, id) => {
    const g = re.exec(id);
    return g ? Math.max(m, Number(g[1])) : m;
  }, 0);
  return `${type}-${max + 1}`;
}

export function newNode(
  type: FlowNodeType,
  position: { x: number; y: number },
  existingIds: string[] = [],
): RFNode {
  return {
    id: nextNodeId(type, existingIds),
    type,
    position,
    data: { type, config: defaultConfig(type) } satisfies FlowNodeData,
  };
}
```

同時改 `ui.tsx` 呼叫端(`addNode` 內):

```ts
setNodes((ns) => [...ns, newNode(type, findFreePosition(ns.map((n) => n.position)), ns.map((n) => n.id))]);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/model.spec.ts src/tools/flow-builder/ui.spec.tsx`
Expected: 全 PASS(ui.spec 的「palette adds a node」靠新推導邏輯仍然成立)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/model.ts apps/web/src/tools/flow-builder/model.spec.ts apps/web/src/tools/flow-builder/ui.tsx
git commit -m "refactor(web): derive flow node ids from existing ids instead of module counter

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `nodes.tsx` 節點標籤 i18n(minor)

**Files:**
- Modify: `apps/web/src/tools/flow-builder/nodes.tsx`
- Modify: `apps/web/src/tools/flow-builder/nodes.spec.tsx`
- Modify: `apps/web/src/tools/flow-builder/messages.ts`(`ToolUI` 段新增鍵)

**Interfaces:**
- Consumes: 既有 `Shell` / `META` 結構(`nodes.tsx`)。
- Produces: i18n 鍵 `flowNodeStart/flowNodeEnd/flowNodeForm/flowNodeCondition/flowNodeAction/flowNodeFields/flowNodeKind`(en + zh-TW)。

- [ ] **Step 1: 寫失敗測試** — `nodes.spec.tsx` 全檔改為(render 包 `NextIntlClientProvider`;斷言沿用既有英文字串,另補 zh-TW 一例證明走 i18n):

```tsx
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { messages } from "./messages";
import { nodeTypes } from "./nodes";

function renderNode(type: keyof typeof nodeTypes, data: Record<string, unknown>, locale: "en" | "zh-TW" = "en") {
  const Cmp = nodeTypes[type] as React.ComponentType<{ id: string; data: unknown }>;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale] as Record<string, unknown>}>
      <Cmp id="n1" data={data} />
    </NextIntlClientProvider>,
  );
}

describe("flow node components", () => {
  it("form node shows its label and field count", () => {
    renderNode("form", { type: "form", config: { version: 1, fields: [{ key: "a" }, { key: "b" }] } });
    expect(screen.getByText(/form/i)).toBeTruthy();
    expect(screen.getByText(/2 fields/i)).toBeTruthy();
  });

  it("action node shows its kind", () => {
    renderNode("action", { type: "action", config: { kind: "notify", params: {} } });
    expect(screen.getByText(/kind: notify/i)).toBeTruthy();
  });

  it("condition node renders its label", () => {
    renderNode("condition", { type: "condition" });
    expect(screen.getByText(/condition/i)).toBeTruthy();
  });

  it("labels are localized (zh-TW)", () => {
    renderNode("form", { type: "form", config: { version: 1, fields: [{ key: "a" }] } }, "zh-TW");
    expect(screen.getByText("表單")).toBeTruthy();
    expect(screen.getByText(/1 個欄位/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/nodes.spec.tsx`
Expected: FAIL —— zh-TW 案例找不到「表單」(現況硬編英文)。

- [ ] **Step 3: 實作**

`messages.ts` 的 `en.ToolUI` 新增:

```ts
      flowNodeStart: "Start",
      flowNodeEnd: "End",
      flowNodeForm: "Form",
      flowNodeCondition: "Condition",
      flowNodeAction: "Action",
      flowNodeFields: "{count} fields",
      flowNodeKind: "kind: {kind}",
```

`zh-TW.ToolUI` 新增:

```ts
      flowNodeStart: "開始",
      flowNodeEnd: "結束",
      flowNodeForm: "表單",
      flowNodeCondition: "條件",
      flowNodeAction: "動作",
      flowNodeFields: "{count} 個欄位",
      flowNodeKind: "種類:{kind}",
```

`nodes.tsx`:`META` 移除 `label` 欄位(只留 `border`/`head`,型別同步改 `Record<FlowNodeType, { border: string; head: string }>`),檔頭加 `import { useTranslations } from "next-intl";`,各節點元件改為:

```tsx
const StartNode = () => {
  const t = useTranslations("ToolUI");
  return (
    <Shell type="start" title={t("flowNodeStart")}>
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const EndNode = () => {
  const t = useTranslations("ToolUI");
  return (
    <Shell type="end" title={t("flowNodeEnd")}>
      <Handle type="target" position={Position.Left} />
    </Shell>
  );
};
const FormNode = ({ data }: NodeProps) => {
  const t = useTranslations("ToolUI");
  const d = data as FlowNodeData;
  return (
    <Shell type="form" title={t("flowNodeForm")}>
      <Handle type="target" position={Position.Left} />
      {t("flowNodeFields", { count: fieldCount(d.config) })}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ActionNode = ({ data }: NodeProps) => {
  const t = useTranslations("ToolUI");
  const d = data as FlowNodeData;
  const kind = (d.config as { kind?: string } | undefined)?.kind ?? "—";
  return (
    <Shell type="action" title={t("flowNodeAction")}>
      <Handle type="target" position={Position.Left} />
      {t("flowNodeKind", { kind })}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ConditionNode = () => {
  const t = useTranslations("ToolUI");
  return (
    <Shell type="condition" title={t("flowNodeCondition")}>
      <Handle type="target" position={Position.Left} />
      <Handle id="yes" type="source" position={Position.Right} style={{ top: "35%" }} />
      <Handle id="no" type="source" position={Position.Right} style={{ top: "65%" }} />
    </Shell>
  );
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/nodes.spec.tsx src/tools/flow-builder/ui.spec.tsx`
Expected: 全 PASS(ui.spec 的 render 已包 provider,節點元件在 mock ReactFlow 下不會真的渲染,不受影響)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/nodes.tsx apps/web/src/tools/flow-builder/nodes.spec.tsx apps/web/src/tools/flow-builder/messages.ts
git commit -m "fix(web): localize flow-builder node type labels via toolui i18n

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `projectFlow` 投影純函式

**Files:**
- Create: `apps/web/src/tools/flow-builder/projection.ts`
- Create: `apps/web/src/tools/flow-builder/projection.spec.ts`

**Interfaces:**
- Consumes: `FlowDoc`/`FlowEdge`/`FlowNodeType`(`./schema`)。
- Produces: `projectFlow(doc: FlowDoc, options: { keep: FlowNodeType[] }): FlowDoc`(Task 6 使用)。

- [ ] **Step 1: 寫失敗測試** — `projection.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { FlowDoc } from "./schema";
import { projectFlow } from "./projection";

/** start → form → cond ─yes→ act1 → end / ─no→ act2 → end(內建範例的拓撲)。 */
const doc: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 0 } },
    { id: "form1", type: "form", position: { x: 200, y: 0 } },
    { id: "cond1", type: "condition", position: { x: 400, y: 0 } },
    { id: "act1", type: "action", position: { x: 600, y: -80 } },
    { id: "act2", type: "action", position: { x: 600, y: 80 } },
    { id: "end", type: "end", position: { x: 800, y: 0 } },
  ],
  edges: [
    { id: "e1", source: "start", target: "form1" },
    { id: "e2", source: "form1", target: "cond1", trigger: "onSubmit" },
    { id: "e3", source: "cond1", target: "act1", sourceHandle: "yes", label: "yes" },
    { id: "e4", source: "cond1", target: "act2", sourceHandle: "no", label: "no" },
    { id: "e5", source: "act1", target: "end" },
    { id: "e6", source: "act2", target: "end" },
  ],
};

describe("projectFlow", () => {
  it("keeps start/end regardless of the keep set", () => {
    const out = projectFlow(doc, { keep: [] });
    expect(out.nodes.map((n) => n.id)).toEqual(["start", "end"]);
  });

  it("filters actions and contracts edges, keeping yes/no as parallel labeled edges", () => {
    const out = projectFlow(doc, { keep: ["form", "condition"] });
    expect(out.nodes.map((n) => n.id)).toEqual(["start", "form1", "cond1", "end"]);
    const contracted = out.edges.filter((e) => e.source === "cond1" && e.target === "end");
    expect(contracted).toHaveLength(2); // yes/no 平行邊不被去重
    expect(contracted.map((e) => e.label).sort()).toEqual(["no", "yes"]);
    expect(contracted.map((e) => e.id).sort()).toEqual(["proj-cond1-end-no", "proj-cond1-end-yes"]);
    // 縮線邊沿用鏈上第一條邊的 sourceHandle
    expect(contracted.find((e) => e.label === "yes")?.sourceHandle).toBe("yes");
    // 縮線邊不沿用 trigger/condition
    expect(contracted.every((e) => e.trigger === undefined && e.condition === undefined)).toBe(true);
  });

  it("preserves untouched original edges with all fields", () => {
    const out = projectFlow(doc, { keep: ["form", "condition"] });
    expect(out.edges.find((e) => e.id === "e2")?.trigger).toBe("onSubmit");
  });

  it("contracts through chains of removed nodes", () => {
    const chain: FlowDoc = {
      version: 1,
      nodes: [
        { id: "s", type: "start", position: { x: 0, y: 0 } },
        { id: "a1", type: "action", position: { x: 100, y: 0 } },
        { id: "a2", type: "action", position: { x: 200, y: 0 } },
        { id: "e", type: "end", position: { x: 300, y: 0 } },
      ],
      edges: [
        { id: "c1", source: "s", target: "a1", label: "go" },
        { id: "c2", source: "a1", target: "a2" },
        { id: "c3", source: "a2", target: "e" },
      ],
    };
    const out = projectFlow(chain, { keep: [] });
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0]).toMatchObject({ id: "proj-s-e-go", source: "s", target: "e", label: "go" });
  });

  it("dedupes identical (source, target, label) and drops self-loops; survives cycles among removed nodes", () => {
    const loop: FlowDoc = {
      version: 1,
      nodes: [
        { id: "s", type: "start", position: { x: 0, y: 0 } },
        { id: "a1", type: "action", position: { x: 100, y: 0 } },
        { id: "a2", type: "action", position: { x: 200, y: 0 } },
        { id: "e", type: "end", position: { x: 300, y: 0 } },
      ],
      edges: [
        { id: "l1", source: "s", target: "a1" },
        { id: "l2", source: "a1", target: "a2" },
        { id: "l3", source: "a2", target: "a1" }, // 被移除節點間的環
        { id: "l4", source: "a1", target: "e" },
        { id: "l5", source: "a2", target: "e" },
      ],
    };
    const out = projectFlow(loop, { keep: [] });
    // 兩條路徑 s→…→e 都無 label → 去重成一條;不會無窮迴圈
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0]).toMatchObject({ source: "s", target: "e" });
  });

  it("does not mutate the input doc", () => {
    const snapshot = JSON.stringify(doc);
    projectFlow(doc, { keep: [] });
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/projection.spec.ts`
Expected: FAIL —— 找不到模組 `./projection`。

- [ ] **Step 3: 實作** — `projection.ts`:

```ts
import type { FlowDoc, FlowEdge, FlowNodeType } from "./schema";

export interface ProjectOptions {
  /** 要保留的「中間節點」型別;start/end 永遠保留,不受此參數影響。 */
  keep: FlowNodeType[];
}

/** 縮線新邊 id:label 併入以保住 yes/no 平行邊的唯一性。 */
function contractedId(source: string, target: string, label?: string): string {
  return label ? `proj-${source}-${target}-${label}` : `proj-${source}-${target}`;
}

/** 節點型別過濾投影:移除不在 keep 集合的中間節點,其入邊×出邊自動「縮線」接起。 */
export function projectFlow(doc: FlowDoc, options: ProjectOptions): FlowDoc {
  const keep = new Set<FlowNodeType>(["start", "end", ...options.keep]);
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  const isKept = (id: string): boolean => {
    const n = nodeById.get(id);
    return n !== undefined && keep.has(n.type);
  };

  const outgoing = new Map<string, FlowEdge[]>();
  for (const e of doc.edges) {
    const list = outgoing.get(e.source);
    if (list) list.push(e);
    else outgoing.set(e.source, [e]);
  }

  const edges: FlowEdge[] = [];
  const seen = new Set<string>(); // (source, target, label) 去重

  // 只從「保留節點的出邊」出發,沿被移除節點 DFS,收所有可達的保留節點。
  for (const first of doc.edges) {
    if (!isKept(first.source)) continue;
    const stack: FlowEdge[] = [first];
    const visited = new Set<string>(); // 防被移除節點間的環
    while (stack.length > 0) {
      const edge = stack.pop()!;
      if (isKept(edge.target)) {
        if (first.source === edge.target) continue; // 自環丟棄
        const key = `${first.source}|${edge.target}|${first.label ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (edge === first) {
          edges.push({ ...first }); // 未經縮線:原樣保留(含 trigger/condition)
        } else {
          edges.push({
            id: contractedId(first.source, edge.target, first.label),
            source: first.source,
            target: edge.target,
            ...(first.sourceHandle !== undefined ? { sourceHandle: first.sourceHandle } : {}),
            ...(first.label !== undefined ? { label: first.label } : {}),
          });
        }
      } else if (!visited.has(edge.target)) {
        visited.add(edge.target);
        for (const next of outgoing.get(edge.target) ?? []) stack.push(next);
      }
    }
  }

  return {
    version: 1,
    nodes: doc.nodes.filter((n) => keep.has(n.type)).map((n) => ({ ...n })),
    edges,
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/projection.spec.ts`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/projection.ts apps/web/src/tools/flow-builder/projection.spec.ts
git commit -m "feat(web): add flow projection with edge contraction for filtered views

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `bpmn.ts` 基礎 helpers(XML 轉義 + id 安全化)

**Files:**
- Create: `apps/web/src/tools/flow-builder/bpmn.ts`
- Create: `apps/web/src/tools/flow-builder/bpmn.spec.ts`

**Interfaces:**
- Produces: `escapeXml(value: string): string`;`makeIdMapper(prefix: string): (raw: string) => string`(Task 5 內部使用;export 供測試)。

- [ ] **Step 1: 寫失敗測試** — `bpmn.spec.ts`:

```ts
import { describe, expect, it } from "vitest";

import { escapeXml, makeIdMapper } from "./bpmn";

describe("escapeXml", () => {
  it("escapes the five xml special characters", () => {
    expect(escapeXml(`a<b>&"c"'d'`)).toBe("a&lt;b&gt;&amp;&quot;c&quot;&apos;d&apos;");
  });
});

describe("makeIdMapper", () => {
  it("prefixes and keeps ncname-safe chars", () => {
    const map = makeIdMapper("Node");
    expect(map("form-1")).toBe("Node_form-1");
  });

  it("is stable for the same raw id", () => {
    const map = makeIdMapper("Node");
    expect(map("a")).toBe(map("a"));
  });

  it("sanitizes illegal chars and resolves collisions deterministically", () => {
    const map = makeIdMapper("Node");
    expect(map("a b")).toBe("Node_a_b");
    expect(map("a_b")).toBe("Node_a_b_2"); // sanitize 後撞名 → 附序號
    expect(map("a b")).toBe("Node_a_b"); // 既有對映不受影響
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/bpmn.spec.ts`
Expected: FAIL —— 找不到模組 `./bpmn`。

- [ ] **Step 3: 實作** — `bpmn.ts`:

```ts
/** XML 屬性/文字轉義(& 必須最先換)。 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * raw id → 合法 NCName 的穩定對映:`<prefix>_<sanitized>`(前綴保證開頭合法),
 * 非 [A-Za-z0-9_.-] 一律換 `_`;sanitize 後撞名附 `_2`、`_3`…。
 */
export function makeIdMapper(prefix: string): (raw: string) => string {
  const byRaw = new Map<string, string>();
  const used = new Set<string>();
  return (raw: string): string => {
    const hit = byRaw.get(raw);
    if (hit !== undefined) return hit;
    const base = `${prefix}_${raw.replace(/[^A-Za-z0-9_.-]/g, "_")}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}_${n}`;
    byRaw.set(raw, id);
    used.add(id);
    return id;
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/bpmn.spec.ts`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/bpmn.ts apps/web/src/tools/flow-builder/bpmn.spec.ts
git commit -m "feat(web): add xml escaping and ncname id mapping helpers for bpmn export

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `compileToBpmn` — FlowDoc → BPMN 2.0 XML

**Files:**
- Modify: `apps/web/src/tools/flow-builder/bpmn.ts`(接在 helpers 之後)
- Modify: `apps/web/src/tools/flow-builder/bpmn.spec.ts`

**Interfaces:**
- Consumes: `escapeXml`/`makeIdMapper`(Task 4)、`FlowDoc`/`FlowNode`/`FlowNodeType`(`./schema`)、內建 `sample`(`./sample`,測試用)。
- Produces: `compileToBpmn(doc: FlowDoc): string`(Task 6 使用)。

- [ ] **Step 1: 寫失敗測試** — `bpmn.spec.ts` 追加:

```ts
import type { FlowDoc } from "./schema";
import { sample } from "./sample";
import { compileToBpmn, escapeXml, makeIdMapper } from "./bpmn";

/** 收集 XML 內所有 id 與引用,驗證引用完整性(輕量 regex parse,不引第三方)。 */
function collectIdsAndRefs(xml: string): { ids: Set<string>; refs: string[] } {
  const ids = new Set([...xml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!));
  const refs = [
    ...[...xml.matchAll(/\b(?:sourceRef|targetRef|bpmnElement)="([^"]+)"/g)].map((m) => m[1]!),
    ...[...xml.matchAll(/<bpmn:(?:incoming|outgoing)>([^<]+)</g)].map((m) => m[1]!),
  ];
  return { ids, refs };
}

describe("compileToBpmn", () => {
  const xml = compileToBpmn(sample);

  it("maps node types to bpmn elements", () => {
    expect(xml).toContain("<bpmn:startEvent");
    expect(xml).toContain("<bpmn:endEvent");
    expect(xml).toContain("<bpmn:userTask");
    expect(xml).toContain("<bpmn:exclusiveGateway");
    expect(xml).toContain("<bpmn:serviceTask");
  });

  it("has the required document skeleton", () => {
    expect(xml).toContain("<bpmn:definitions");
    expect(xml).toContain('<bpmn:process id="Process_1" isExecutable="false">');
    expect(xml).toContain("<bpmndi:BPMNDiagram");
    expect(xml).toContain('<bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">');
  });

  it("every ref points to an existing id", () => {
    const { ids, refs } = collectIdsAndRefs(xml);
    for (const ref of refs) expect(ids.has(ref), `unresolved ref: ${ref}`).toBe(true);
  });

  it("every node has a shape and every edge has a di edge", () => {
    expect([...xml.matchAll(/<bpmndi:BPMNShape /g)]).toHaveLength(sample.nodes.length);
    expect([...xml.matchAll(/<bpmndi:BPMNEdge /g)]).toHaveLength(sample.edges.length);
  });

  it("uses standard bpmn sizes centered on the flowdoc node center", () => {
    // sample 的 start 在 (40,127),RF 佔位 150×46 → 中心 (115,150) → 36×36 的左上 (97,132)
    expect(xml).toContain('<dc:Bounds x="97" y="132" width="36" height="36" />');
    // condition 在 (460,127) → 中心 (535,150) → 50×50 的左上 (510,125)
    expect(xml).toContain('<dc:Bounds x="510" y="125" width="50" height="50" />');
    // form 在 (250,119),150×62 → bounds 原值
    expect(xml).toContain('<dc:Bounds x="250" y="119" width="150" height="62" />');
    // gateway 有 marker
    expect(xml).toContain('isMarkerVisible="true"');
  });

  it("waypoints run from source right-center to target left-center", () => {
    // start(36×36 @ 97,132)右緣中心 (133,150) → form(150×62 @ 250,119)左緣中心 (250,150)
    expect(xml).toContain('<di:waypoint x="133" y="150" /><di:waypoint x="250" y="150" />');
  });

  it("condition yes/no outgoing flows carry names", () => {
    expect(xml).toMatch(/<bpmn:sequenceFlow [^>]*name="yes"/);
    expect(xml).toMatch(/<bpmn:sequenceFlow [^>]*name="no"/);
  });

  it("names: action includes its kind; labels are escaped", () => {
    expect(xml).toContain('name="Action: notify"');
    const hostile: FlowDoc = {
      version: 1,
      nodes: [
        { id: "s", type: "start", position: { x: 0, y: 0 } },
        { id: "e", type: "end", position: { x: 200, y: 0 } },
      ],
      edges: [{ id: "x", source: "s", target: "e", label: 'a<b>&"c"' }],
    };
    const out = compileToBpmn(hostile);
    expect(out).toContain('name="a&lt;b&gt;&amp;&quot;c&quot;"');
  });

  it("skips edges whose source/target node does not exist (orphan guard)", () => {
    const broken: FlowDoc = {
      version: 1,
      nodes: [{ id: "s", type: "start", position: { x: 0, y: 0 } }],
      edges: [{ id: "x", source: "s", target: "ghost" }],
    };
    const out = compileToBpmn(broken);
    expect(out).not.toContain("sequenceFlow");
    const { ids, refs } = collectIdsAndRefs(out);
    for (const ref of refs) expect(ids.has(ref)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/bpmn.spec.ts`
Expected: FAIL —— `compileToBpmn is not a function`。

- [ ] **Step 3: 實作** — `bpmn.ts` 追加:

```ts
import type { FlowDoc, FlowNode, FlowNodeType } from "./schema";

// React Flow 畫布上的節點佔位(對齊 sample.ts 的座標假設)。
const RF_W = 150;
const RF_H: Record<FlowNodeType, number> = { start: 46, end: 46, condition: 46, form: 62, action: 62 };

// BPMN 慣例尺寸:event 36×36、gateway 50×50、task 150×62,以 RF 佔位中心對齊。
const BPMN_SIZE: Record<FlowNodeType, { w: number; h: number }> = {
  start: { w: 36, h: 36 },
  end: { w: 36, h: 36 },
  condition: { w: 50, h: 50 },
  form: { w: 150, h: 62 },
  action: { w: 150, h: 62 },
};

const BPMN_ELEMENT: Record<FlowNodeType, string> = {
  start: "startEvent",
  end: "endEvent",
  form: "userTask",
  condition: "exclusiveGateway",
  action: "serviceTask",
};

// BPMN name 是匯出物、非 UI 文案 → 維持英文常數,不吃 i18n(純函式不依賴 locale)。
function nodeName(node: FlowNode): string {
  if (node.type === "action") {
    const kind = (node.config as { kind?: string } | undefined)?.kind;
    return kind ? `Action: ${kind}` : "Action";
  }
  const names: Record<Exclude<FlowNodeType, "action">, string> = {
    start: "Start",
    end: "End",
    form: "Form",
    condition: "Condition",
  };
  return names[node.type];
}

function nodeBounds(node: FlowNode): { x: number; y: number; w: number; h: number } {
  const { w, h } = BPMN_SIZE[node.type];
  const cx = node.position.x + RF_W / 2;
  const cy = node.position.y + RF_H[node.type] / 2;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h };
}

/** FlowDoc → BPMN 2.0 XML(單向編譯;形狀比照 bpmn-viewer/samples.ts 的合法樣本)。 */
export function compileToBpmn(doc: FlowDoc): string {
  const nodeId = makeIdMapper("Node");
  const flowId = makeIdMapper("Flow");
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
  // 孤兒引用防護:source/target 不存在的邊跳過,保證 id 引用永遠完整。
  const edges = doc.edges.filter((e) => nodeById.has(e.source) && nodeById.has(e.target));

  const processEls = doc.nodes.map((n) => {
    const el = BPMN_ELEMENT[n.type];
    const refs = [
      ...edges.filter((e) => e.target === n.id).map((e) => `<bpmn:incoming>${flowId(e.id)}</bpmn:incoming>`),
      ...edges.filter((e) => e.source === n.id).map((e) => `<bpmn:outgoing>${flowId(e.id)}</bpmn:outgoing>`),
    ].join("");
    return `<bpmn:${el} id="${nodeId(n.id)}" name="${escapeXml(nodeName(n))}">${refs}</bpmn:${el}>`;
  });

  const flowEls = edges.map((e) => {
    const name = e.label ? ` name="${escapeXml(e.label)}"` : "";
    return `<bpmn:sequenceFlow id="${flowId(e.id)}"${name} sourceRef="${nodeId(e.source)}" targetRef="${nodeId(e.target)}" />`;
  });

  const shapes = doc.nodes.map((n) => {
    const b = nodeBounds(n);
    const marker = n.type === "condition" ? ' isMarkerVisible="true"' : "";
    return `<bpmndi:BPMNShape id="${nodeId(n.id)}_di" bpmnElement="${nodeId(n.id)}"${marker}><dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" /></bpmndi:BPMNShape>`;
  });

  const diEdges = edges.map((e) => {
    const s = nodeBounds(nodeById.get(e.source)!);
    const t = nodeBounds(nodeById.get(e.target)!);
    return `<bpmndi:BPMNEdge id="${flowId(e.id)}_di" bpmnElement="${flowId(e.id)}"><di:waypoint x="${s.x + s.w}" y="${Math.round(s.y + s.h / 2)}" /><di:waypoint x="${t.x}" y="${Math.round(t.y + t.h / 2)}" /></bpmndi:BPMNEdge>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">`,
    `<bpmn:process id="Process_1" isExecutable="false">`,
    ...processEls,
    ...flowEls,
    `</bpmn:process>`,
    `<bpmndi:BPMNDiagram id="Diagram_1">`,
    `<bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">`,
    ...shapes,
    ...diEdges,
    `</bpmndi:BPMNPlane>`,
    `</bpmndi:BPMNDiagram>`,
    `</bpmn:definitions>`,
  ].join("\n");
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/bpmn.spec.ts`
Expected: 全 PASS(若座標斷言失敗,先人工重算 sample 座標,不要直接改斷言遷就實作)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/bpmn.ts apps/web/src/tools/flow-builder/bpmn.spec.ts
git commit -m "feat(web): compile flowdoc to bpmn 2.0 xml with di layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `BpmnViewPanel` 元件(viewer + 投影切換 + 下載)

**Files:**
- Create: `apps/web/src/tools/flow-builder/bpmn-view.tsx`
- Create: `apps/web/src/tools/flow-builder/bpmn-view.spec.tsx`
- Modify: `apps/web/src/tools/flow-builder/messages.ts`(`ToolUI` 段新增鍵)

**Interfaces:**
- Consumes: `compileToBpmn`(Task 5)、`projectFlow`(Task 3)、`BpmnViewer`(`@rfjs/bpmn-ui`)、`Switch`(`@rfjs/web-ui/components/switch`,Radix:`checked`/`onCheckedChange`,role="switch")、`Button`。
- Produces: `BpmnViewPanel({ doc }: { doc: FlowDoc })`(Task 7 使用);i18n 鍵 `flowBpmnProjection/flowBpmnDownload/flowBpmnLabel`。

- [ ] **Step 1: 寫失敗測試** — `bpmn-view.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/bpmn-ui", () => ({
  BpmnViewer: ({ xml }: { xml: string }) => <div data-testid="bpmn-viewer">{xml}</div>,
}));

import { messages } from "./messages";
import { sample } from "./sample";
import { BpmnViewPanel } from "./bpmn-view";

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <BpmnViewPanel doc={sample} />
    </NextIntlClientProvider>,
  );
}

describe("BpmnViewPanel", () => {
  it("feeds compiled bpmn xml to the viewer", () => {
    renderPanel();
    const xml = screen.getByTestId("bpmn-viewer").textContent ?? "";
    expect(xml).toContain("<bpmn:definitions");
    expect(xml).toContain("<bpmn:userTask");
    expect(xml).toContain("<bpmn:serviceTask");
  });

  it("projection switch filters service tasks but keeps user tasks", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("switch", { name: /human tasks only/i }));
    const xml = screen.getByTestId("bpmn-viewer").textContent ?? "";
    expect(xml).not.toContain("<bpmn:serviceTask");
    expect(xml).toContain("<bpmn:userTask");
    expect(xml).toContain("<bpmn:exclusiveGateway");
  });

  it("download button builds a blob url and clicks an anchor", () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(Object.create(URL), { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /download \.bpmn/i }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/bpmn-view.spec.tsx`
Expected: FAIL —— 找不到模組 `./bpmn-view`。

- [ ] **Step 3: 實作**

`messages.ts` 的 `en.ToolUI` 新增:

```ts
      flowTabEdit: "Edit",
      flowTabBpmn: "BPMN",
      flowBpmnProjection: "Human tasks only",
      flowBpmnDownload: "Download .bpmn",
      flowBpmnLabel: "BPMN diagram",
```

`zh-TW.ToolUI` 新增:

```ts
      flowTabEdit: "編輯",
      flowTabBpmn: "BPMN",
      flowBpmnProjection: "只看人工節點",
      flowBpmnDownload: "下載 .bpmn",
      flowBpmnLabel: "BPMN 流程圖",
```

(`flowTabEdit`/`flowTabBpmn` 供 Task 7 使用,與本任務的鍵同段落一次加齊。)

`bpmn-view.tsx`:

```tsx
"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";

import { BpmnViewer } from "@rfjs/bpmn-ui";
import { Button } from "@rfjs/web-ui/components/button";
import { Switch } from "@rfjs/web-ui/components/switch";

import { compileToBpmn } from "./bpmn";
import { projectFlow } from "./projection";
import type { FlowDoc } from "./schema";

// dark 模式容器套 invert(做法複製自 bpmn-viewer tool 的 ui.tsx;因並行紅線
// 不動共用檔,本地維護一份):圖形填色 #b9b9b9 → 反轉後 ≈ #464646,
// 明顯比畫布(#d4d4d4 → #2b2b2b)亮,shape 內底不是死黑。
const BPMN_DARK_CSS = `
.dark .bpmn-invert .djs-visual rect,
.dark .bpmn-invert .djs-visual circle,
.dark .bpmn-invert .djs-visual polygon {
  fill: #b9b9b9 !important;
}
`;

/** BPMN 分頁面板:即時編譯當前 FlowDoc → 唯讀檢視 + 投影切換 + 下載 .bpmn。 */
export function BpmnViewPanel({ doc }: { doc: FlowDoc }) {
  const t = useTranslations("ToolUI");
  const [projected, setProjected] = React.useState(false);

  const xml = React.useMemo(
    () => compileToBpmn(projected ? projectFlow(doc, { keep: ["form", "condition"] }) : doc),
    [doc, projected],
  );

  const onDownload = () => {
    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "flow.bpmn";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={projected} onCheckedChange={setProjected} aria-label={t("flowBpmnProjection")} />
          {t("flowBpmnProjection")}
        </label>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onDownload}>
          <Download className="mr-1 h-4 w-4" />
          {t("flowBpmnDownload")}
        </Button>
      </div>
      <style>{BPMN_DARK_CSS}</style>
      <BpmnViewer
        xml={xml}
        ariaLabel={t("flowBpmnLabel")}
        className="bpmn-invert h-[560px] w-full rounded-md border bg-white dark:bg-[#d4d4d4] dark:invert dark:hue-rotate-180"
      />
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/bpmn-view.spec.tsx`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/bpmn-view.tsx apps/web/src/tools/flow-builder/bpmn-view.spec.tsx apps/web/src/tools/flow-builder/messages.ts
git commit -m "feat(web): add bpmn view panel with projection toggle and .bpmn download

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `ui.tsx` 「編輯 / BPMN」分頁整合

**Files:**
- Modify: `apps/web/src/tools/flow-builder/ui.tsx`
- Modify: `apps/web/src/tools/flow-builder/ui.spec.tsx`

**Interfaces:**
- Consumes: `BpmnViewPanel({ doc })`(Task 6)、`toFlowDoc`/`flowToJson`(既有)、i18n 鍵 `flowTabEdit`/`flowTabBpmn`(Task 6 已加入 messages)。

- [ ] **Step 1: 寫失敗測試** — `ui.spec.tsx` 檔頭 mocks 區(`vi.mock("@rfjs/filter-builder-ui", …)` 之後)追加:

```tsx
vi.mock("@rfjs/bpmn-ui", () => ({
  BpmnViewer: ({ xml }: { xml: string }) => <div data-testid="bpmn-viewer">{xml}</div>,
}));
```

describe 內追加:

```tsx
  it("defaults to the edit tab (canvas + palette visible)", () => {
    renderTool();
    expect(screen.getByTestId("rf")).toBeTruthy();
    expect(screen.getByRole("button", { name: /\+ action/i })).toBeTruthy();
    expect(screen.queryByTestId("bpmn-viewer")).toBeNull();
  });

  it("bpmn tab swaps the canvas for the viewer, hides the palette, keeps json", () => {
    renderTool();
    fireEvent.click(screen.getByRole("button", { name: /^bpmn$/i }));
    const viewer = screen.getByTestId("bpmn-viewer");
    expect(viewer.textContent).toContain("<bpmn:definitions");
    expect(screen.queryByTestId("rf")).toBeNull();
    expect(screen.queryByRole("button", { name: /\+ action/i })).toBeNull();
    expect(screen.getByText(/"version": 1/)).toBeTruthy(); // Flow JSON 仍在
    // 切回編輯
    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect(screen.getByTestId("rf")).toBeTruthy();
  });

  it("switching to bpmn clears the node selection (inspector closes)", () => {
    renderTool();
    fireEvent.click(screen.getByTestId("rfnode-form-1"));
    expect(screen.getByTestId("cfb")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^bpmn$/i }));
    expect(screen.queryByTestId("cfb")).toBeNull();
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/flow-builder/ui.spec.tsx`
Expected: FAIL —— 找不到名為 `bpmn` 的按鈕。

- [ ] **Step 3: 實作** — `ui.tsx` 修改(比照 form-builder `ui.tsx:340-362` 的 segmented tabs 模式):

檔頭 import 追加:

```tsx
import { BpmnViewPanel } from "./bpmn-view";
```

`FlowBuilderInner` 內,`selectedId` state 之後追加 view state;`json` 改由共用的 `doc` memo 導出:

```tsx
  const [view, setView] = React.useState<"edit" | "bpmn">("edit");
  const doc = React.useMemo(() => toFlowDoc(nodes, edges), [nodes, edges]);
  const json = React.useMemo(() => flowToJson(doc), [doc]);
```

(移除原本 `const json = React.useMemo(() => flowToJson(toFlowDoc(nodes, edges)), [nodes, edges]);`。)

return 的 eyebrow 之後、palette 之前插入分頁列,並把「palette + 畫布」包進 edit 分支:

```tsx
      <div className="inline-flex w-fit gap-0.5 rounded-lg border border-input bg-muted/30 p-1">
        {([
          { id: "edit", label: t("flowTabEdit") },
          { id: "bpmn", label: t("flowTabBpmn") },
        ] as const).map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setView(v.id);
              if (v.id === "bpmn") setSelectedId(null); // BPMN 唯讀:關 inspector
            }}
            aria-selected={view === v.id}
            className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
              view === v.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "edit" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* 既有四顆 + Form / + Condition / + Action / + End 按鈕原樣搬進來 */}
          </div>
          <div className="h-[560px] w-full rounded-md border">
            {/* 既有 <ReactFlow …> 區塊原樣搬進來 */}
          </div>
        </>
      ) : (
        <BpmnViewPanel doc={doc} />
      )}
```

(Flow JSON 區與 NodeSheet 保持在分支之外,兩個分頁都顯示 JSON;NodeSheet 因切換時 `setSelectedId(null)` 在 BPMN 分頁必為關閉。)

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/flow-builder/`
Expected: flow-builder 全部 spec PASS。

- [ ] **Step 5: 型別與 lint 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint`
Expected: 皆通過(若 check-types 報 `@rfjs/*` 解析錯誤,先 `pnpm build:packages` 再重跑)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/flow-builder/ui.tsx apps/web/src/tools/flow-builder/ui.spec.tsx
git commit -m "feat(web): add edit/bpmn tab switch to flow-builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: e2e + 全套驗證

**Files:**
- Modify: `apps/web/e2e/flow-builder.e2e.ts`(追加一條測試)

**Interfaces:**
- Consumes: Task 7 的分頁按鈕(accessible name `BPMN`)、bpmn-js 真渲染的 `.djs-container svg .djs-element`(pattern 比照 `apps/web/e2e/bpmn-viewer.e2e.ts:8`)。

- [ ] **Step 1: 追加 e2e 測試** — `flow-builder.e2e.ts` 檔尾:

```ts
test("bpmn tab renders the compiled diagram as svg shapes", async ({ page }) => {
  await page.goto(URL);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /^bpmn$/i }).click();
  // bpmn-js 真渲染:.djs-container 內出現 shape 元素(內建 sample 有 6 個節點)
  const shapes = page.locator(".djs-container svg .djs-element");
  await expect(shapes.first()).toBeVisible({ timeout: 15_000 });
  expect(await shapes.count()).toBeGreaterThanOrEqual(6);
});
```

- [ ] **Step 2: 跑 e2e**

Run: `pnpm -F web test:e2e`
Expected: 全 PASS(playwright 自起 dev server 於 port 3002;首次啟動慢是正常)。含既有 flow-builder 3 條 + bpmn-viewer 3 條 + 新 1 條。

- [ ] **Step 3: 全套單元測試**

Run: `pnpm -F web test`
Expected: apps/web 全部 spec PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/flow-builder.e2e.ts
git commit -m "test(web): cover flow-builder bpmn tab rendering in e2e

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 真渲染驗證(主 session 執行,非 subagent)

**Files:** 無程式變更;產出截圖供使用者驗收。

- [ ] **Step 1:** `pnpm -F web build` 通過後 `pnpm -F web start -- --port 3005`(或 `pnpm exec next start -p 3005`,於 `apps/web`)。
- [ ] **Step 2:** 以 Playwright MCP 開 `http://localhost:3005/en/tools/flow-builder`,截圖驗收(存 scratchpad):
  - light:編輯分頁(基準)、BPMN 分頁完整圖、BPMN 分頁投影開(serviceTask 消失、yes/no label 仍在)。
  - dark(切換主題後):BPMN 分頁完整圖 —— 確認 invert 後線條/文字可讀、shape 內底非死黑。
  - 檢查點:小圓(start/end)、菱形(condition)、圓角矩形(form/action)、主線對齊、yes/no 標籤、下載按鈕存在。
- [ ] **Step 3:** 截圖貼給使用者確認後,走 superpowers:finishing-a-development-branch(push + 開 PR,**HOLD 不 merge**)。

PR 描述要點(英文):tab-switched read-only BPMN view compiled from FlowDoc(one-way, FlowDoc remains the source of truth)、projection with edge contraction、`.bpmn` download、node label i18n、nodeSeq refactor;附截圖。
