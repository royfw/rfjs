# flow-builder tool (apps/web) Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/web` 加一個 `flow-builder` tool —— 可編輯的 React Flow 流程畫布,節點內嵌既有編輯器(`ConfigFormBuilder` / `FilterTreeEditor`),即時產出自有 flow JSON,**但不執行**(Phase 1 無 runtime)。

**Architecture:** App-local tool(`apps/web/src/tools/flow-builder/`)。FlowDoc(zod)是資料契約;`@xyflow/react` 畫布的 nodes/edges 以 `model.ts` 純函式與 FlowDoc 互轉;節點只顯示精簡預覽,選取後在右側 inspector 內嵌真正的編輯器;底部 JSON 面板即時顯示 `flowToJson`。先不抽 `@rfjs/flow` 套件。

**Tech Stack:** React 19、`@xyflow/react@^12`(MIT,React Flow)、`@rfjs/form-builder-ui`(`ConfigFormBuilder`)、`@rfjs/filter-builder-ui`(`FilterTreeEditor`)+ `@rfjs/filter-builder`(`emptyGroup`/types)、zod、Vitest(jsdom,mock React Flow)、`@playwright/test`(e2e)、next-intl。

## Global Constraints

- 全程在 worktree `.claude/worktrees/feat-flow-tool` 內(由 `origin/main` 建立)。
- **Phase 1 無 runtime**:不執行流程、不評估條件、不跑 action;不持久化;不抽 `@rfjs/flow` 套件;不做 join/select、AI、durable、迴圈/平行、auto-layout。
- **schema 鎖定且預留 Phase 2 欄位**:`FlowEdge.trigger`、`FlowEdge.condition`、`FlowNode.inputs`(多輸入)、`FlowNode.outputCollection`(集合輸出)—— Phase 1 只存不執行。
- `node.config` **直接內嵌既有工具 JSON**(form→`FormConfig`、condition→`BuilderGroup`、action→`{kind,params}`),不發明新格式。
- tool id = `flow-builder`;category `generator`;surface `web`;status `preview`;relatedPackages `['@rfjs/form-builder','@rfjs/filter-builder']`(兩者皆已在 packageRegistry,**不新增 package 條目**)。
- i18n:tool UI 字串放 `ToolUI`,鍵以 **`flow*` 前綴**(避免 `index.spec` 的 ToolUI 衝突檢查);`Tools['flow-builder'].{title,description}` en + zh-TW。
- 檔名 kebab-case;co-locate `*.spec.ts(x)`。
- commit 英文 conventional,**subject 全小寫開頭**(commitlint 拒 sentence-case),結尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`(最後一行)。
- apps/web 測試:`pnpm -C <worktree> --filter web vitest:run -- <pattern>`;e2e:`... --filter web test:e2e`。
- 私有 / app-local 變更 **無 changeset**。**HOLD PR**。

> 下文相對路徑相對於 worktree 根。`<worktree>` = `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-flow-tool`。git 指令實際執行時帶 `-C <worktree>`(為精簡省略)。

---

## Task 1: 加 @xyflow/react 相依 + flow JSON schema(zod)

**Files:**
- Modify: `apps/web/package.json`(dependencies 加 `@xyflow/react`)
- Create: `apps/web/src/tools/flow-builder/schema.ts`
- Test: `apps/web/src/tools/flow-builder/schema.spec.ts`

**Interfaces:**
- Produces:
  - 型別 `FlowNodeType = 'start'|'end'|'form'|'condition'|'action'`、`FlowNode`、`FlowEdge`、`FlowDoc`
  - `flowDocSchema`(zod)、`parseFlow(json: string): FlowDoc`、`flowToJson(doc: FlowDoc): string`、`emptyFlow(): FlowDoc`

- [ ] **Step 1: 加相依並安裝**

`apps/web/package.json` 的 `dependencies` 加入(放 `@rfjs/*` 之後、字母序不強制):
```json
    "@xyflow/react": "^12.11.1",
```
Run:
```bash
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-flow-tool install
```
Expected: 安裝成功,`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 寫失敗測試 `apps/web/src/tools/flow-builder/schema.spec.ts`**

```ts
import { describe, expect, it } from "vitest";

import { flowDocSchema, parseFlow, flowToJson, emptyFlow } from "./schema";

describe("flow schema", () => {
  it("emptyFlow has version 1 and a single start node", () => {
    const f = emptyFlow();
    expect(f.version).toBe(1);
    expect(f.nodes).toHaveLength(1);
    expect(f.nodes[0]!.type).toBe("start");
    expect(f.edges).toEqual([]);
  });

  it("accepts a valid doc and round-trips through JSON", () => {
    const doc = {
      version: 1 as const,
      nodes: [
        { id: "start", type: "start" as const, position: { x: 0, y: 0 } },
        { id: "f1", type: "form" as const, position: { x: 1, y: 2 }, config: { version: 1, fields: [] } },
      ],
      edges: [{ id: "e1", source: "start", target: "f1", trigger: "onSubmit" }],
    };
    expect(() => flowDocSchema.parse(doc)).not.toThrow();
    expect(parseFlow(flowToJson(doc))).toEqual(doc);
  });

  it("rejects an unknown node type and a bad version", () => {
    expect(() => flowDocSchema.parse({ version: 1, nodes: [{ id: "x", type: "nope", position: { x: 0, y: 0 } }], edges: [] })).toThrow();
    expect(() => flowDocSchema.parse({ version: 2, nodes: [], edges: [] })).toThrow();
  });

  it("preserves the reserved phase-2 fields (trigger/condition/inputs/outputCollection)", () => {
    const doc = {
      version: 1 as const,
      nodes: [{ id: "j", type: "action" as const, position: { x: 0, y: 0 }, inputs: ["a", "b"], outputCollection: true }],
      edges: [{ id: "e", source: "a", target: "j", condition: { any: true } }],
    };
    const parsed = flowDocSchema.parse(doc);
    expect(parsed.nodes[0]!.inputs).toEqual(["a", "b"]);
    expect(parsed.nodes[0]!.outputCollection).toBe(true);
    expect(parsed.edges[0]!.condition).toEqual({ any: true });
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/schema`
Expected: FAIL —— 找不到 `./schema`。

- [ ] **Step 4: 實作 `apps/web/src/tools/flow-builder/schema.ts`**

```ts
import { z } from "zod";

export const flowNodeTypeSchema = z.enum(["start", "end", "form", "condition", "action"]);

export const flowNodeSchema = z.object({
  id: z.string().min(1),
  type: flowNodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  // 內嵌既有工具 JSON;Phase 1 以 unknown 透傳(深度驗證交給各編輯器)。
  config: z.unknown().optional(),
  // 預留(Phase 2 才執行,Phase 1 只存):
  inputs: z.array(z.string()).optional(),
  outputCollection: z.boolean().optional(),
});

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  label: z.string().optional(),
  // 預留(Phase 2 navigation runtime):
  trigger: z.string().optional(),
  condition: z.unknown().optional(),
});

export const flowDocSchema = z.object({
  version: z.literal(1),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
});

export type FlowNodeType = z.infer<typeof flowNodeTypeSchema>;
export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowDoc = z.infer<typeof flowDocSchema>;

/** 全新流程:一顆 start 節點。 */
export const emptyFlow = (): FlowDoc => ({
  version: 1,
  nodes: [{ id: "start", type: "start", position: { x: 0, y: 0 } }],
  edges: [],
});

export const parseFlow = (json: string): FlowDoc => flowDocSchema.parse(JSON.parse(json));

export const flowToJson = (doc: FlowDoc): string => JSON.stringify(doc, null, 2);
```

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/schema`
Expected: PASS(4 passed)。

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/tools/flow-builder/schema.ts apps/web/src/tools/flow-builder/schema.spec.ts
git commit -m "feat(flow): add @xyflow/react dep and flow JSON schema

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: flow model(FlowDoc ↔ React Flow 純函式)

**Files:**
- Create: `apps/web/src/tools/flow-builder/model.ts`
- Test: `apps/web/src/tools/flow-builder/model.spec.ts`

**Interfaces:**
- Consumes: `FlowDoc`, `FlowNodeType` from `./schema`
- Produces:
  - `interface FlowNodeData { type: FlowNodeType; config?: unknown; label?: string }`
  - `defaultConfig(type: FlowNodeType): unknown`
  - `toReactFlow(doc: FlowDoc): { nodes: RFNode[]; edges: RFEdge[] }`(RFNode/RFEdge = `@xyflow/react` 的 `Node`/`Edge`)
  - `toFlowDoc(nodes: RFNode[], edges: RFEdge[]): FlowDoc`
  - `newNode(type: FlowNodeType, position: { x: number; y: number }): RFNode`

- [ ] **Step 1: 寫失敗測試 `apps/web/src/tools/flow-builder/model.spec.ts`**

```ts
import { describe, expect, it } from "vitest";

import { toReactFlow, toFlowDoc, newNode, defaultConfig } from "./model";
import { emptyFlow, flowDocSchema } from "./schema";

describe("flow model", () => {
  it("toReactFlow maps nodes/edges and carries type+config in data", () => {
    const doc = {
      version: 1 as const,
      nodes: [{ id: "f1", type: "form" as const, position: { x: 3, y: 4 }, config: { version: 1, fields: [] } }],
      edges: [{ id: "e1", source: "start", target: "f1", sourceHandle: "yes", label: "ok" }],
    };
    const { nodes, edges } = toReactFlow(doc);
    expect(nodes[0]).toMatchObject({ id: "f1", type: "form", position: { x: 3, y: 4 } });
    expect((nodes[0]!.data as { type: string; config: unknown }).type).toBe("form");
    expect((nodes[0]!.data as { config: unknown }).config).toEqual({ version: 1, fields: [] });
    expect(edges[0]).toMatchObject({ id: "e1", source: "start", target: "f1", sourceHandle: "yes", label: "ok" });
  });

  it("toFlowDoc is the inverse of toReactFlow (round-trip, schema-valid)", () => {
    const doc = emptyFlow();
    const { nodes, edges } = toReactFlow(doc);
    const back = toFlowDoc(nodes, edges);
    expect(() => flowDocSchema.parse(back)).not.toThrow();
    expect(back).toEqual(doc);
  });

  it("newNode gives a typed node with default config and a unique id", () => {
    const a = newNode("action", { x: 1, y: 1 });
    const b = newNode("action", { x: 2, y: 2 });
    expect(a.type).toBe("action");
    expect((a.data as { config: unknown }).config).toEqual({ kind: "notify", params: {} });
    expect(a.id).not.toBe(b.id);
  });

  it("defaultConfig: form→empty FormConfig, action→notify, others undefined", () => {
    expect(defaultConfig("form")).toEqual({ version: 1, fields: [] });
    expect(defaultConfig("action")).toEqual({ kind: "notify", params: {} });
    expect(defaultConfig("condition")).toBeUndefined();
    expect(defaultConfig("start")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/model`
Expected: FAIL —— 找不到 `./model`。

- [ ] **Step 3: 實作 `apps/web/src/tools/flow-builder/model.ts`**

```ts
import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";

import type { FlowDoc, FlowNodeType } from "./schema";

export interface FlowNodeData {
  type: FlowNodeType;
  config?: unknown;
  label?: string;
  [key: string]: unknown;
}

/** 各節點型別的預設 config(內嵌既有工具 JSON 的初值)。 */
export function defaultConfig(type: FlowNodeType): unknown {
  switch (type) {
    case "form":
      return { version: 1, fields: [] }; // FormConfig
    case "action":
      return { kind: "notify", params: {} };
    default:
      return undefined; // condition 由 inspector 以 emptyGroup 延遲種子;start/end 無 config
  }
}

export function toReactFlow(doc: FlowDoc): { nodes: RFNode[]; edges: RFEdge[] } {
  const nodes: RFNode[] = doc.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { type: n.type, config: n.config } satisfies FlowNodeData,
  }));
  const edges: RFEdge[] = doc.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    label: e.label,
  }));
  return { nodes, edges };
}

export function toFlowDoc(nodes: RFNode[], edges: RFEdge[]): FlowDoc {
  return {
    version: 1,
    nodes: nodes.map((n) => {
      const data = n.data as FlowNodeData;
      return { id: n.id, type: data.type, position: n.position, config: data.config };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      label: typeof e.label === "string" ? e.label : undefined,
    })),
  };
}

let nodeSeq = 0;
export function newNode(type: FlowNodeType, position: { x: number; y: number }): RFNode {
  nodeSeq += 1;
  return {
    id: `${type}-${nodeSeq}`,
    type,
    position,
    data: { type, config: defaultConfig(type) } satisfies FlowNodeData,
  };
}
```

- [ ] **Step 4: 跑測試 + typecheck 確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/model && pnpm -C <worktree> --filter web check-types`
Expected: PASS;typecheck 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/model.ts apps/web/src/tools/flow-builder/model.spec.ts
git commit -m "feat(flow): add flow model mapping FlowDoc to React Flow nodes/edges

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 自訂節點元件(精簡預覽)

**Files:**
- Create: `apps/web/src/tools/flow-builder/nodes.tsx`
- Test: `apps/web/src/tools/flow-builder/nodes.spec.tsx`

**Interfaces:**
- Consumes: `FlowNodeData` from `./model`
- Produces: `const nodeTypes: Record<FlowNodeType, ComponentType<NodeProps>>`(start/end/form/condition/action 五個元件 + 對映表)

- [ ] **Step 1: 寫失敗測試 `apps/web/src/tools/flow-builder/nodes.spec.tsx`**

> 直接 render 節點元件(不需真 React Flow);`Handle` 來自 `@xyflow/react`,在 jsdom 下能渲染(只是無佈局)。包一層 `ReactFlowProvider` 讓 `Handle` 有 context。

> mock `@xyflow/react` 的 `Handle`/`Position`,讓節點元件能脫離真 React Flow context 渲染(只驗精簡預覽文字)。

```tsx
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

import { nodeTypes } from "./nodes";

function renderNode(type: keyof typeof nodeTypes, data: Record<string, unknown>) {
  const Cmp = nodeTypes[type] as React.ComponentType<{ id: string; data: unknown }>;
  return render(<Cmp id="n1" data={data} />);
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
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/nodes`
Expected: FAIL —— 找不到 `./nodes`。

- [ ] **Step 3: 實作 `apps/web/src/tools/flow-builder/nodes.tsx`**

```tsx
"use client";

import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FlowNodeData } from "./model";
import type { FlowNodeType } from "./schema";

const META: Record<FlowNodeType, { label: string; color: string; bg: string }> = {
  start: { label: "Start", color: "#475569", bg: "#f1f5f9" },
  end: { label: "End", color: "#047857", bg: "#ecfdf5" },
  form: { label: "Form", color: "#1d4ed8", bg: "#eff6ff" },
  condition: { label: "Condition", color: "#b45309", bg: "#fffbeb" },
  action: { label: "Action", color: "#6d28d9", bg: "#f5f3ff" },
};

function Shell({ type, title, children }: { type: FlowNodeType; title: string; children?: React.ReactNode }) {
  const m = META[type];
  return (
    <div className="min-w-[150px] rounded-lg border bg-card shadow-sm" style={{ borderColor: m.color + "55" }}>
      <div className="flex items-center gap-2 rounded-t-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: m.bg, color: m.color }}>
        <span>{title}</span>
      </div>
      {children ? <div className="px-2.5 py-2 text-[11px] text-muted-foreground">{children}</div> : null}
    </div>
  );
}

function fieldCount(config: unknown): number {
  const c = config as { fields?: unknown[]; sections?: { rows?: { items?: unknown[] }[] }[] } | undefined;
  if (!c) return 0;
  if (Array.isArray(c.fields)) return c.fields.length;
  if (Array.isArray(c.sections)) return c.sections.reduce((n, s) => n + (s.rows ?? []).reduce((m, r) => m + (r.items?.length ?? 0), 0), 0);
  return 0;
}

const StartNode = () => (
  <Shell type="start" title={META.start.label}>
    <Handle type="source" position={Position.Right} />
  </Shell>
);
const EndNode = () => (
  <Shell type="end" title={META.end.label}>
    <Handle type="target" position={Position.Left} />
  </Shell>
);
const FormNode = ({ data }: NodeProps) => {
  const d = data as FlowNodeData;
  return (
    <Shell type="form" title={META.form.label}>
      <Handle type="target" position={Position.Left} />
      {`${fieldCount(d.config)} fields`}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ActionNode = ({ data }: NodeProps) => {
  const d = data as FlowNodeData;
  const kind = (d.config as { kind?: string } | undefined)?.kind ?? "—";
  return (
    <Shell type="action" title={META.action.label}>
      <Handle type="target" position={Position.Left} />
      {`kind: ${kind}`}
      <Handle type="source" position={Position.Right} />
    </Shell>
  );
};
const ConditionNode = () => (
  <Shell type="condition" title={META.condition.label}>
    <Handle type="target" position={Position.Left} />
    <Handle id="yes" type="source" position={Position.Right} style={{ top: "35%" }} />
    <Handle id="no" type="source" position={Position.Right} style={{ top: "65%" }} />
  </Shell>
);

export const nodeTypes: Record<FlowNodeType, React.ComponentType<NodeProps>> = {
  start: StartNode as React.ComponentType<NodeProps>,
  end: EndNode as React.ComponentType<NodeProps>,
  form: FormNode,
  condition: ConditionNode as React.ComponentType<NodeProps>,
  action: ActionNode,
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/nodes`
Expected: PASS(3 passed)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/nodes.tsx apps/web/src/tools/flow-builder/nodes.spec.tsx
git commit -m "feat(flow): add custom React Flow node components with compact previews

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Inspector(內嵌既有編輯器)

**Files:**
- Create: `apps/web/src/tools/flow-builder/inspector.tsx`
- Test: `apps/web/src/tools/flow-builder/inspector.spec.tsx`

**Interfaces:**
- Consumes: `FlowNodeData` from `./model`;`ConfigFormBuilder` from `@rfjs/form-builder-ui`;`FilterTreeEditor` + `FilterTreeLabels` from `@rfjs/filter-builder-ui`;`emptyGroup` + types from `@rfjs/filter-builder`
- Produces: `function Inspector({ node, onConfigChange, labels }: InspectorProps)` 其中 `InspectorProps = { node: { id: string; data: FlowNodeData } | null; onConfigChange: (id: string, config: unknown) => void; labels: { filter: FilterTreeLabels; actionKinds: string[] } }`

- [ ] **Step 1: 寫失敗測試 `apps/web/src/tools/flow-builder/inspector.spec.tsx`**

> mock 兩個重編輯器,確認 inspector 依節點型別掛上正確編輯器並轉發 config 變更。

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/form-builder-ui", () => ({
  ConfigFormBuilder: ({ onChange }: { onChange?: (c: unknown) => void }) => (
    <button data-testid="cfb" onClick={() => onChange?.({ version: 1, fields: [{ key: "x" }] })}>form-editor</button>
  ),
}));
vi.mock("@rfjs/filter-builder-ui", () => ({
  FilterTreeEditor: () => <div data-testid="fte">filter-editor</div>,
}));

import { Inspector } from "./inspector";

const labels = { filter: {} as never, actionKinds: ["notify", "db.update"] };

describe("Inspector", () => {
  it("form node → ConfigFormBuilder, and forwards config change", () => {
    const onConfigChange = vi.fn();
    render(<Inspector node={{ id: "f1", data: { type: "form", config: { version: 1, fields: [] } } }} onConfigChange={onConfigChange} labels={labels} />);
    fireEvent.click(screen.getByTestId("cfb"));
    expect(onConfigChange).toHaveBeenCalledWith("f1", { version: 1, fields: [{ key: "x" }] });
  });

  it("condition node → FilterTreeEditor", () => {
    render(<Inspector node={{ id: "c1", data: { type: "condition" } }} onConfigChange={vi.fn()} labels={labels} />);
    expect(screen.getByTestId("fte")).toBeTruthy();
  });

  it("action node → kind select, change forwards config", () => {
    const onConfigChange = vi.fn();
    render(<Inspector node={{ id: "a1", data: { type: "action", config: { kind: "notify", params: {} } } }} onConfigChange={onConfigChange} labels={labels} />);
    fireEvent.change(screen.getByLabelText(/kind/i), { target: { value: "db.update" } });
    expect(onConfigChange).toHaveBeenCalledWith("a1", { kind: "db.update", params: {} });
  });

  it("no node selected → hint", () => {
    render(<Inspector node={null} onConfigChange={vi.fn()} labels={labels} />);
    expect(screen.getByText(/select a node/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/inspector`
Expected: FAIL —— 找不到 `./inspector`。

- [ ] **Step 3: 實作 `apps/web/src/tools/flow-builder/inspector.tsx`**

```tsx
"use client";

import * as React from "react";

import { ConfigFormBuilder } from "@rfjs/form-builder-ui";
import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";
import { emptyGroup } from "@rfjs/filter-builder";
import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";

import type { FlowNodeData } from "./model";

export interface InspectorProps {
  node: { id: string; data: FlowNodeData } | null;
  onConfigChange: (id: string, config: unknown) => void;
  labels: { filter: FilterTreeLabels; actionKinds: string[] };
}

const uuid = () => crypto.randomUUID();

// Phase 1:condition 的可用欄位用一組宣告/範例欄位(真正欄位是 Phase 2 的 context 課題)。
const SAMPLE_SCHEMA: FieldSchema[] = [
  { path: "days", dataType: "number", include: true, kind: "jsonb" },
  { path: "amount", dataType: "number", include: true, kind: "jsonb" },
  { path: "status", dataType: "string", include: true, kind: "jsonb" },
];

function ActionInspector({ id, config, kinds, onConfigChange }: { id: string; config: unknown; kinds: string[]; onConfigChange: InspectorProps["onConfigChange"] }) {
  const c = (config as { kind?: string; params?: Record<string, unknown> }) ?? {};
  return (
    <div className="space-y-2">
      <label htmlFor="flow-action-kind" className="block text-xs text-muted-foreground">Action kind</label>
      <select
        id="flow-action-kind"
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        value={c.kind ?? kinds[0]}
        onChange={(e) => onConfigChange(id, { kind: e.target.value, params: c.params ?? {} })}
      >
        {kinds.map((k) => (<option key={k} value={k}>{k}</option>))}
      </select>
    </div>
  );
}

function ConditionInspector({ id, config, labels, onConfigChange }: { id: string; config: unknown; labels: FilterTreeLabels; onConfigChange: InspectorProps["onConfigChange"] }) {
  const [tree, setTree] = React.useState<BuilderGroup>(() => (config as BuilderGroup) ?? emptyGroup(uuid));
  const [schema, setSchema] = React.useState<FieldSchema[]>(SAMPLE_SCHEMA);
  return (
    <FilterTreeEditor
      group={tree}
      engineId="data-filter"
      schema={schema}
      labels={labels}
      onChange={(next) => { setTree(next); onConfigChange(id, next); }}
      onCreateField={(path) => setSchema((s) => [...s, { path, dataType: "string", include: true, kind: "jsonb" }])}
    />
  );
}

export function Inspector({ node, onConfigChange, labels }: InspectorProps) {
  if (!node) return <p className="text-sm text-muted-foreground">Select a node to edit it.</p>;
  const { id, data } = node;
  switch (data.type) {
    case "form":
      return (
        <ConfigFormBuilder
          initialConfig={(data.config as { version: 1; fields: [] }) ?? { version: 1, fields: [] }}
          onChange={(cfg) => onConfigChange(id, cfg)}
          locale="en"
          locales={["en", "zh-TW"]}
        />
      );
    case "condition":
      return <ConditionInspector id={id} config={data.config} labels={labels.filter} onConfigChange={onConfigChange} />;
    case "action":
      return <ActionInspector id={id} config={data.config} kinds={labels.actionKinds} onConfigChange={onConfigChange} />;
    default:
      return <p className="text-sm text-muted-foreground">This node has no settings.</p>;
  }
}
```

> 註:`ConfigFormBuilder` 的 `initialConfig` 型別是 `FormConfig`(`@rfjs/form-builder`)。若 TS 對 inline cast 不滿意,改 `import type { FormConfig } from "@rfjs/form-builder"` 並 cast `data.config as FormConfig`。`FieldSchema` = `{ path: string; dataType: FieldType; include: boolean; kind: FieldKind }`(已採用此 shape);`dataType` 的允許值以 `FieldType` 實際型別為準(`"number"`/`"string"` 應有效,否則依 `packages/filter-builder/src/types.ts` 調整),`kind` 用 `"jsonb"`。

- [ ] **Step 4: 跑測試 + typecheck 確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/inspector && pnpm -C <worktree> --filter web check-types`
Expected: PASS(4 passed);typecheck 無錯誤(必要時依上註調整 cast / `FieldSchema` 欄位)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/flow-builder/inspector.tsx apps/web/src/tools/flow-builder/inspector.spec.tsx
git commit -m "feat(flow): add inspector embedding ConfigFormBuilder and FilterTreeEditor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 組裝 FlowBuilderTool(畫布 + palette + inspector + JSON 面板)+ i18n + 註冊模組

**Files:**
- Create: `apps/web/src/tools/flow-builder/sample.ts`
- Create: `apps/web/src/tools/flow-builder/messages.ts`
- Create: `apps/web/src/tools/flow-builder/ui.tsx`
- Create: `apps/web/src/tools/flow-builder/index.ts`
- Test: `apps/web/src/tools/flow-builder/ui.spec.tsx`

**Interfaces:**
- Consumes: `nodeTypes`(./nodes)、`Inspector`(./inspector)、`toReactFlow`/`toFlowDoc`/`newNode`(./model)、`flowToJson`(./schema)、`sample`(./sample)
- Produces: `function FlowBuilderTool()`;`const tool: ToolModule = { id: "flow-builder", Component: FlowBuilderTool }`;`const messages: LocaleMessages`

- [ ] **Step 1: 寫 `apps/web/src/tools/flow-builder/sample.ts`**

```ts
import type { FlowDoc } from "./schema";

/** 內建範例:請假申請 → 判斷 → 通知 / 自動核准。 */
export const sample: FlowDoc = {
  version: 1,
  nodes: [
    { id: "start", type: "start", position: { x: 0, y: 120 } },
    { id: "form-1", type: "form", position: { x: 150, y: 100 }, config: { version: 1, fields: [{ key: "days", label: "Days", component: "Number", dataType: "number" }] } },
    { id: "cond-1", type: "condition", position: { x: 380, y: 110 } },
    { id: "act-1", type: "action", position: { x: 600, y: 40 }, config: { kind: "notify", params: {} } },
    { id: "act-2", type: "action", position: { x: 600, y: 200 }, config: { kind: "db.update", params: {} } },
    { id: "end", type: "end", position: { x: 820, y: 120 } },
  ],
  edges: [
    { id: "e1", source: "start", target: "form-1" },
    { id: "e2", source: "form-1", target: "cond-1", trigger: "onSubmit" },
    { id: "e3", source: "cond-1", target: "act-1", sourceHandle: "yes", label: "yes" },
    { id: "e4", source: "cond-1", target: "act-2", sourceHandle: "no", label: "no" },
    { id: "e5", source: "act-1", target: "end" },
    { id: "e6", source: "act-2", target: "end" },
  ],
};
```

- [ ] **Step 2: 寫 `apps/web/src/tools/flow-builder/messages.ts`**

```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "flow-builder": {
        title: "Flow Builder",
        description: "Visually wire a no-code flow — drag form / condition / action nodes onto a canvas, edit each node with the embedded builders, and see the flow JSON live. (Phase 1: edit only, no execution.)",
      },
    },
    ToolUI: {
      flowEyebrow: "FLOW BUILDER",
      flowAddForm: "+ Form",
      flowAddCondition: "+ Condition",
      flowAddAction: "+ Action",
      flowAddEnd: "+ End",
      flowInspector: "Inspector",
      flowJson: "Flow JSON",
      flowSelectHint: "Select a node to edit it.",
      flowFilterAddCondition: "+ condition",
      flowFilterAddGroup: "+ group",
      flowFilterRemoveGroup: "remove group",
      flowFilterRemoveCondition: "remove",
      flowFilterElemMatch: "elemmatch",
    },
  },
  "zh-TW": {
    Tools: {
      "flow-builder": {
        title: "流程建構器",
        description: "視覺化串接 no-code 流程 —— 把表單 / 條件 / 動作節點拖到畫布、用內嵌的編輯器設定每個節點,並即時看到 flow JSON。(Phase 1:只編輯、不執行。)",
      },
    },
    ToolUI: {
      flowEyebrow: "流程建構器",
      flowAddForm: "+ 表單",
      flowAddCondition: "+ 條件",
      flowAddAction: "+ 動作",
      flowAddEnd: "+ 結束",
      flowInspector: "屬性面板",
      flowJson: "流程 JSON",
      flowSelectHint: "選一個節點來編輯。",
      flowFilterAddCondition: "+ 條件",
      flowFilterAddGroup: "+ 群組",
      flowFilterRemoveGroup: "移除群組",
      flowFilterRemoveCondition: "移除",
      flowFilterElemMatch: "elemmatch",
    },
  },
};
```

- [ ] **Step 3: 寫失敗測試 `apps/web/src/tools/flow-builder/ui.spec.tsx`**

> mock `@xyflow/react`(jsdom 無法量測佈局):提供最小的 `ReactFlow`(渲染 children + 把目前 nodes 數量曝光)、`useNodesState`/`useEdgesState`/`addEdge`/`Background`/`Controls`/`ReactFlowProvider`/`Handle`/`Position`。也 mock 兩個重編輯器(同 inspector.spec)。頂部加 jsdom shims。

```tsx
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", async () => {
  const React2 = await vi.importActual<typeof import("react")>("react");
  return {
    ReactFlow: ({ nodes, children }: { nodes: unknown[]; children?: React.ReactNode }) => (
      <div data-testid="rf" data-nodecount={nodes.length}>{children}</div>
    ),
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
    addEdge: (c: unknown, edges: unknown[]) => [...edges, c],
    useNodesState: (initial: unknown[]) => {
      const [n, setN] = React2.useState(initial);
      return [n, setN, () => {}];
    },
    useEdgesState: (initial: unknown[]) => {
      const [e, setE] = React2.useState(initial);
      return [e, setE, () => {}];
    },
  };
});
vi.mock("@rfjs/form-builder-ui", () => ({ ConfigFormBuilder: () => <div data-testid="cfb" /> }));
vi.mock("@rfjs/filter-builder-ui", () => ({ FilterTreeEditor: () => <div data-testid="fte" /> }));

import { messages } from "./messages";
import { FlowBuilderTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <FlowBuilderTool />
    </NextIntlClientProvider>,
  );
}

describe("FlowBuilderTool", () => {
  it("renders the sample flow into the canvas", () => {
    renderTool();
    expect(Number(screen.getByTestId("rf").getAttribute("data-nodecount"))).toBeGreaterThanOrEqual(6);
  });

  it("palette '+ Action' adds a node (count increases)", () => {
    renderTool();
    const before = Number(screen.getByTestId("rf").getAttribute("data-nodecount"));
    fireEvent.click(screen.getByRole("button", { name: /\+ action/i }));
    expect(Number(screen.getByTestId("rf").getAttribute("data-nodecount"))).toBe(before + 1);
  });

  it("shows the live flow JSON panel containing a node id", () => {
    renderTool();
    expect(screen.getByText(/"flow-builder"|"start"|"version": 1/)).toBeTruthy();
  });
});
```

- [ ] **Step 4: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/ui`
Expected: FAIL —— 找不到 `./ui`。

- [ ] **Step 5: 寫 `apps/web/src/tools/flow-builder/ui.tsx`**

```tsx
"use client";

import * as React from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslations } from "next-intl";

import { Button } from "@rfjs/web-ui/components/button";
import type { FilterTreeLabels } from "@rfjs/filter-builder-ui";

import type { ToolModule } from "@/tools/types";
import { nodeTypes } from "./nodes";
import { Inspector } from "./inspector";
import { newNode, toFlowDoc, toReactFlow, type FlowNodeData } from "./model";
import { flowToJson } from "./schema";
import { sample } from "./sample";

let pasteSeq = 0; // 避免新節點都疊在同一點

function FlowBuilderInner() {
  const t = useTranslations("ToolUI");
  const seeded = React.useMemo(() => toReactFlow(sample), []);
  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filterLabels: FilterTreeLabels = {
    logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
    addCondition: t("flowFilterAddCondition"),
    addGroup: t("flowFilterAddGroup"),
    removeGroup: t("flowFilterRemoveGroup"),
    removeCondition: t("flowFilterRemoveCondition"),
    elemMatch: t("flowFilterElemMatch"),
  };

  const onConnect = React.useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const addNode = (type: Parameters<typeof newNode>[0]) => {
    pasteSeq += 1;
    setNodes((ns) => [...ns, newNode(type, { x: 120 + pasteSeq * 24, y: 260 + pasteSeq * 16 })]);
  };

  const onConfigChange = React.useCallback((id: string, config: unknown) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...(n.data as FlowNodeData), config } } : n)));
  }, [setNodes]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const json = React.useMemo(() => flowToJson(toFlowDoc(nodes, edges)), [nodes, edges]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("flowEyebrow")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => addNode("form")}>{t("flowAddForm")}</Button>
        <Button size="sm" variant="outline" onClick={() => addNode("condition")}>{t("flowAddCondition")}</Button>
        <Button size="sm" variant="outline" onClick={() => addNode("action")}>{t("flowAddAction")}</Button>
        <Button size="sm" variant="outline" onClick={() => addNode("end")}>{t("flowAddEnd")}</Button>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3">
        <div className="h-[520px] rounded-md border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e: React.MouseEvent, n: Node) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("flowInspector")}</p>
          <Inspector
            node={selected ? { id: selected.id, data: selected.data as FlowNodeData } : null}
            onConfigChange={onConfigChange}
            labels={{ filter: filterLabels, actionKinds: ["notify", "db.update", "http"] }}
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("flowJson")}</p>
        <pre className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed">{json}</pre>
      </div>
    </div>
  );
}

export function FlowBuilderTool() {
  // ReactFlowProvider 提供 Handle / hooks 的 context。
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 6: 寫 `apps/web/src/tools/flow-builder/index.ts`**

```ts
import type { ToolModule } from "@/tools/types";

import { FlowBuilderTool } from "./ui";

export const tool: ToolModule = { id: "flow-builder", Component: FlowBuilderTool };
```

- [ ] **Step 7: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- flow-builder/ui`
Expected: PASS(3 passed)。

> `FilterTreeLabels` 的 `logic` 鍵 `and`/`or`/`nor`/`not` = `LogicOp` 實際值(已確認)。若某個 `@xyflow/react` import 未使用觸發 lint,移除之。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/tools/flow-builder/sample.ts apps/web/src/tools/flow-builder/messages.ts \
  apps/web/src/tools/flow-builder/ui.tsx apps/web/src/tools/flow-builder/index.ts \
  apps/web/src/tools/flow-builder/ui.spec.tsx
git commit -m "feat(flow): assemble flow-builder tool ui (canvas, palette, inspector, json)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 註冊 tool(registry + 聚合器 + spec)

**Files:**
- Modify: `packages/web-core/src/registry/tools.ts`(append tool 條目)
- Modify: `apps/web/src/tools/index.ts`(import + `toolModules`)
- Modify: `apps/web/src/tools/messages.ts`(import + `toolMessages`)
- Modify: `apps/web/src/tools/index.spec.ts`(`EXPECTED_WEB_TOOL_IDS` 加 `"flow-builder"`)

**Interfaces:**
- Consumes: `tool`、`messages` from `./flow-builder`

- [ ] **Step 1: 先改 spec(EXPECTED ids)讓它失敗** — `apps/web/src/tools/index.spec.ts`

把 `EXPECTED_WEB_TOOL_IDS` 陣列尾端(`"bpmn-viewer",` 之後)加一行:
```ts
  "bpmn-viewer",
  "flow-builder",
].sort();
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- tools/index`
Expected: FAIL —— `toolModules` 尚未含 `flow-builder`(且 catalog 也缺)。

- [ ] **Step 3: web-core registry append** — `packages/web-core/src/registry/tools.ts`

在 `bpmn-viewer` 條目之後、`object-transformer`(workbench)之前插入:
```ts
  {
    id: 'flow-builder',
    category: 'generator',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/form-builder', '@rfjs/filter-builder'],
    tags: ['flow', 'builder', 'canvas', 'no-code'],
  },
```

- [ ] **Step 4: 聚合器 `apps/web/src/tools/index.ts`**

加 import(在 `bpmnViewer` 那行之後;若無 bpmnViewer 別名則放最後一個 import 後):
```ts
import { tool as flowBuilder } from "./flow-builder";
```
加入 `toolModules` 陣列尾端:
```ts
  bpmnViewer,
  flowBuilder,
];
```

- [ ] **Step 5: 聚合器 `apps/web/src/tools/messages.ts`**

加 import:
```ts
import { messages as flowBuilder } from "./flow-builder/messages";
```
加入 `toolMessages` 陣列尾端(順序與 index.ts 對齊):
```ts
  bpmnViewer,
  flowBuilder,
];
```

- [ ] **Step 6: 跑測試確認通過**

Run:
```bash
pnpm -C <worktree> --filter web vitest:run -- tools/index
pnpm -C <worktree> --filter @rfjs/web-core test
pnpm -C <worktree> --filter web check-types
```
Expected: 全綠 —— `registers exactly the expected web tools`、catalog 含 `flow-builder`、aggregators 一致、ToolUI 無衝突;web-core registry schema(relatedPackages 皆存在)通過。

- [ ] **Step 7: Commit**

```bash
git add packages/web-core/src/registry/tools.ts apps/web/src/tools/index.ts \
  apps/web/src/tools/messages.ts apps/web/src/tools/index.spec.ts
git commit -m "feat(flow): register flow-builder tool in registry and aggregators

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Playwright e2e(真畫布渲染)

**Files:**
- Create: `apps/web/e2e/flow-builder.e2e.ts`

**Interfaces:** 無程式介面;純測試。e2e 基礎設施(`apps/web/playwright.config.ts`、`test:e2e` script、chromium)已於 bpmn-viewer 上線時建立。

- [ ] **Step 1: 建 `apps/web/e2e/flow-builder.e2e.ts`**

```ts
import { test, expect } from "@playwright/test";

const URL = "/en/tools/flow-builder";

test("renders the sample flow as React Flow nodes", async ({ page }) => {
  await page.goto(URL);
  const nodes = page.locator(".react-flow__node");
  await expect(nodes.first()).toBeVisible({ timeout: 15_000 });
  expect(await nodes.count()).toBeGreaterThanOrEqual(6);
});

test("palette adds a node", async ({ page }) => {
  await page.goto(URL);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  const before = await page.locator(".react-flow__node").count();
  await page.getByRole("button", { name: /\+ action/i }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(before + 1);
});

test("live JSON panel reflects the flow", async ({ page }) => {
  await page.goto(URL);
  await page.locator(".react-flow__node").first().waitFor({ timeout: 15_000 });
  await expect(page.getByText('"version": 1')).toBeVisible();
});
```

- [ ] **Step 2: 跑 e2e**

Run: `pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-flow-tool --filter web test:e2e -- flow-builder`
Expected: 3 passed。

> 排錯:若 `.react-flow__node` 選不到,先確認 `/en/tools/flow-builder` 有載入(`.react-flow` 容器存在);React Flow 需要容器有高度 —— ui.tsx 的 `h-[520px]` 已給。若沙箱無法跑瀏覽器,記錄為已知限制(同 bpmn 的處理),檔案仍 commit。

- [ ] **Step 3: Commit**

```bash
git add apps/web/e2e/flow-builder.e2e.ts
git commit -m "test(flow): add Playwright e2e smoke for flow-builder (render, add node, json)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 終審驗證

**Files:** 無(僅驗證,必要時小修)。

- [ ] **Step 1: 全綠**

Run:
```bash
pnpm -C <worktree> --filter web check-types
pnpm -C <worktree> --filter web lint
pnpm -C <worktree> --filter web vitest:run
pnpm -C <worktree> --filter @rfjs/web-core test
```
Expected: 全部綠。lint 若報 `flow-builder/` 內未使用 import / `any` 等,就地修。

> 注意:`pnpm -F web lint` 也會掃到既有檔案;只要**你新增的 `flow-builder/` 檔案零問題**即可(其餘既有問題非本計畫範圍,如有,記錄不修)。

- [ ] **Step 2: Next build(SSR / prerender 驗證)**

Run: `pnpm -C <worktree> --filter web build`
Expected: 成功 —— `/[locale]/tools/[slug]` 仍能 prerender(`@xyflow/react` 是 `"use client"` 元件,`flow-builder` 透過 `generateStaticParams` 進入);證明加了 React Flow 後 SSR/build 不崩。
> 若 build 因 React Flow 觸碰 `window`/SSR 報錯:確認 `ui.tsx` 為 `"use client"`;必要時以 `next/dynamic(() => import("./ui").then(m => m.FlowBuilderTool), { ssr: false })` 包一層(但優先保持單純 client 元件)。

- [ ] **Step 3: 手動截圖驗證(light + dark)**

啟動 dev server,瀏覽 `http://localhost:3000/en/tools/flow-builder`:
```bash
pnpm -C <worktree> --filter web dev
```
確認:範例流程畫出、palette 加節點、點節點 → inspector 出對的編輯器(form→ConfigFormBuilder、condition→FilterTreeEditor、action→kind 下拉)、連線可拉、JSON 面板即時更新、深色模式可讀。截圖留存。

- [ ] **Step 4: 確認無殘留 + 不需 changeset**

Run: `git -C <worktree> status`
Expected: 乾淨。app-local / 私有,**不建立 changeset**。

- [ ] **Step 5: HOLD —— 不開 PR**

通知使用者完成 + 手動驗證截圖摘要,等使用者於 GitHub 合併後回報「merged」。

---

## 附錄:Spec ↔ Plan 對應(self-review)

| Spec 需求 | 對應 Task |
| --- | --- |
| flow JSON schema(zod)+ 鎖定 + 預留 trigger/condition/inputs/outputCollection | Task 1 |
| @xyflow/react 相依 | Task 1 |
| flow ↔ React Flow 對映 + 節點操作 | Task 2 |
| 自訂節點(精簡預覽,condition 雙 handle) | Task 3 |
| inspector 內嵌 ConfigFormBuilder / FilterTreeEditor / action 表單 | Task 4 |
| condition 欄位 = 宣告/範例欄位(Phase 1 簡化) | Task 4(SAMPLE_SCHEMA) |
| 範例流程 | Task 5 |
| 畫布 + palette + JSON 面板 + 組裝 + i18n(en/zh,ToolUI flow*) | Task 5 |
| 註冊(registry + 聚合器 + EXPECTED ids;無 packageRegistry 變更) | Task 6 |
| 測試:純函式 + UI(mock React Flow) | Task 1/2/3/4/5 |
| 測試:Playwright e2e 真畫布 | Task 7 |
| SSR/build 驗證 | Task 8(Step 2) |
| 非目標(無 runtime/持久化/套件/auto-layout) | 全程不實作 |
| 無 changeset / HOLD PR | Task 8 |
