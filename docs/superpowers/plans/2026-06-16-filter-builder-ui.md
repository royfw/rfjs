# @rfjs/filter-builder-ui(Part B)實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 query-builder 的樹編輯器抽成共用私有套件 `@rfjs/filter-builder-ui`(`FilterTreeEditor` + `useFilterTree` + colors,labels-as-props),apps/web 改薄消費,**行為不變**。

**Architecture:** 私有套件,比照 `@rfjs/web-ui`——**無 build step**、`exports` 直指 `src/`、由各 Next app 經 `transpilePackages` 吃 TSX。共用元件改吃 `labels` props、**不依賴 next-intl**(消費端各自翻譯)。apps/web 把現有 `useTranslations("ToolUI")` + 既有 hardcode 字串組成 `labels` 傳入,playground 外圍面板(SchemaPanel/Preview/Canonical/ThreePane/引擎切換)留 apps/web。

**Tech Stack:** React 19、`@rfjs/filter-builder`(logic)、`@rfjs/web-ui`(Button)、lucide-react、Vitest + @testing-library/react、next-intl(僅 apps/web 端)。

**Spec:** `docs/superpowers/specs/2026-06-16-query-builder-ui-explorer-integrated-design.md`(Part B 段)

慣例:套件測試 `pnpm -F @rfjs/filter-builder-ui vitest:run`;型別 `pnpm -F @rfjs/filter-builder-ui check-types`;web 測試 `pnpm -F web vitest:run`、型別 `pnpm -F web check-types`、`build`。`@rfjs/*` 相依需先 `pnpm build:packages`(filter-builder 等)。commit subject 小寫、英文;**絕不** `--no-verify`。

---

## 檔案結構

**新套件 `packages/filter-builder-ui/`**(比照 `packages/web-ui/`,**無 tsdown**):
- `package.json`(`private`、`type:module`、`exports` 指 src)、`tsconfig.json`、`vitest.config.mts`
- `src/index.ts`(barrel)
- `src/filter-tree-editor.tsx`(= 現 `builder-tree.tsx` 轉成 labels-as-props,導出 `FilterTreeEditor` + 型別 `FilterTreeLabels`)
- `src/field-combobox.tsx`、`src/value-editor.tsx`(原樣搬)
- `src/colors.ts`(原樣搬)
- `src/use-filter-tree.ts`(新 hook)
- co-located `*.spec.ts(x)`

**apps/web 變更**:
- `apps/web/package.json`:加 `@rfjs/filter-builder-ui` 依賴
- `apps/web/next.config.*`:`transpilePackages` 加 `@rfjs/filter-builder-ui`
- `ui/index.tsx`:組 `labels`、改用 `FilterTreeEditor` + `useFilterTree`
- 刪 `ui/builder-tree.tsx`、`ui/field-combobox.tsx`、`ui/value-editor.tsx`、`logic/colors.ts`(+ 其 spec)

---

## Task 1:Scaffold `@rfjs/filter-builder-ui`

**Files:** create `packages/filter-builder-ui/package.json`、`tsconfig.json`、`vitest.config.mts`、`src/index.ts`;modify `apps/web/package.json`、`apps/web/next.config.*`

- [ ] **Step 1:`packages/filter-builder-ui/package.json`**
```json
{
  "name": "@rfjs/filter-builder-ui",
  "version": "0.0.0",
  "description": "Shared styled filter-tree editor (React) over @rfjs/filter-builder; labels-as-props, consumed via transpilePackages",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "vitest:run": "vitest run"
  },
  "dependencies": {
    "@rfjs/filter-builder": "workspace:*",
    "@rfjs/web-ui": "workspace:*",
    "lucide-react": "^1.17.0"
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

- [ ] **Step 2:`tsconfig.json`** — 複製 web-ui 的:`cp packages/web-ui/tsconfig.json packages/filter-builder-ui/tsconfig.json`

- [ ] **Step 3:`vitest.config.mts`** — 複製 web-ui 的:`cp packages/web-ui/vitest.config.mts packages/filter-builder-ui/vitest.config.mts`(若 web-ui 無此檔,改用 `cp packages/filter-builder/vitest.config.mts ...` 後確認 environment 為 jsdom;component test 需 jsdom)。**確認 vitest `environment: 'jsdom'`**(component test 需要);若複製來的是 node 環境,改成 jsdom。

- [ ] **Step 4:`src/index.ts`** 暫時:
```ts
export {};
```

- [ ] **Step 5:apps/web 接線(先佈好,實作在 Task 3)**
  - `apps/web/package.json` `dependencies` 加 `"@rfjs/filter-builder-ui": "workspace:*"`
  - `apps/web/next.config.*`:`transpilePackages` 陣列加 `"@rfjs/filter-builder-ui"`(現為 `["@rfjs/web-ui", "@rfjs/web-core"]`)

- [ ] **Step 6:** `pnpm install`,然後 `pnpm -F @rfjs/filter-builder-ui check-types && pnpm -F @rfjs/filter-builder-ui vitest:run`(typecheck 乾淨;vitest 0 測試通過)。

- [ ] **Step 7:Commit**
```bash
git add packages/filter-builder-ui apps/web/package.json apps/web/next.config.* pnpm-lock.yaml
git commit -m "chore(filter-builder-ui): scaffold private package + wire apps/web transpile"
```

---

## Task 2:搬元件 + labels 化 + useFilterTree

**Files:** create `src/value-editor.tsx`、`src/field-combobox.tsx`、`src/colors.ts`、`src/filter-tree-editor.tsx`、`src/use-filter-tree.ts`(+ specs);modify `src/index.ts`。全在 `packages/filter-builder-ui/`。

- [ ] **Step 1:原樣搬三個無 i18n 的檔**
```bash
cp apps/web/src/tools/query-builder/ui/value-editor.tsx   packages/filter-builder-ui/src/value-editor.tsx
cp apps/web/src/tools/query-builder/ui/field-combobox.tsx  packages/filter-builder-ui/src/field-combobox.tsx
cp apps/web/src/tools/query-builder/logic/colors.ts        packages/filter-builder-ui/src/colors.ts
```
這三個的 import 不變(`value-editor` 用 `@rfjs/filter-builder` 的 `coerceInput`/型別;`colors` 用 `@rfjs/filter-builder` 的 `LogicOp`;`field-combobox` 只用 react)——都已是套件相依,搬過去解析不變。

- [ ] **Step 2:建 `src/filter-tree-editor.tsx`**(= 現 builder-tree 轉 labels-as-props;移除 `useTranslations`,改吃 `labels`;導出 `FilterTreeEditor` 與 `FilterTreeLabels`):
```tsx
"use client";

import { useEffect } from "react";

import { Button } from "@rfjs/web-ui/components/button";
import { X } from "lucide-react";

import { getEngine, addCondition, addGroup, removeNode, setLogic, updateNode } from "@rfjs/filter-builder";
import type { EngineId, BuilderCondition, BuilderGroup, FieldSchema, LogicOp } from "@rfjs/filter-builder";

import { logicColor, dataTypeColor } from "./colors";
import { FieldCombobox } from "./field-combobox";
import { ValueEditor } from "./value-editor";

export interface FilterTreeLabels {
  logic: Record<LogicOp, string>;
  addCondition: string;
  addGroup: string;
  removeGroup: string;
  removeCondition: string;
  elemMatch: string;
}

const id = () => crypto.randomUUID();

export function FilterTreeEditor({
  group,
  engineId,
  schema,
  onChange,
  onCreateField,
  labels,
  onRemove,
  depth = 0,
}: {
  group: BuilderGroup;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (next: BuilderGroup) => void;
  onCreateField: (path: string) => void;
  labels: FilterTreeLabels;
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
          className={`rounded-sm border bg-transparent px-2 py-1 text-sm ${logicColor(group.logic)}`}
        >
          {(Object.keys(labels.logic) as LogicOp[]).map((l) => (
            <option key={l} value={l}>{labels.logic[l]}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => onChange(addCondition(group, group.id, id))}>
          {labels.addCondition}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onChange(addGroup(group, group.id, id))}>
          {labels.addGroup}
        </Button>
        {onRemove ? (
          <Button size="sm" variant="ghost" aria-label={labels.removeGroup} onClick={onRemove}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 pl-3">
        {group.children.map((child) =>
          child.kind === "group" ? (
            <FilterTreeEditor
              key={child.id}
              group={child}
              engineId={engineId}
              schema={schema}
              labels={labels}
              depth={depth + 1}
              onChange={(nextChild) =>
                onChange({ ...group, children: group.children.map((c) => (c.id === child.id ? nextChild : c)) })
              }
              onRemove={() => onChange(removeNode(group, child.id))}
              onCreateField={onCreateField}
            />
          ) : (
            <ConditionRow
              key={child.id}
              condition={child}
              engineId={engineId}
              schema={schema}
              labels={labels}
              onChange={(patch) => onChange(updateNode(group, child.id, patch))}
              onRemove={() => onChange(removeNode(group, child.id))}
              onCreateField={onCreateField}
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
  onCreateField,
  labels,
}: {
  condition: BuilderCondition;
  engineId: EngineId;
  schema: FieldSchema[];
  onChange: (patch: Omit<Partial<BuilderCondition>, "kind" | "id">) => void;
  onRemove: () => void;
  onCreateField: (path: string) => void;
  labels: FilterTreeLabels;
}) {
  const fields = schema.filter((f) => f.include);
  const engine = getEngine(engineId);
  const field = schema.find((s) => s.path === condition.field);
  const dataType = field?.dataType ?? condition.dataType;
  const elementType = field?.elementType ?? condition.elementType;
  const fieldKind = field?.kind;
  const ops = engine.operators(dataType, elementType, fieldKind);
  const arity = ops.find((o) => o.op === condition.operator)?.arity ?? "one";
  const operatorValid = ops.some((o) => o.op === condition.operator);

  useEffect(() => {
    const patch: Omit<Partial<BuilderCondition>, "kind" | "id"> = {};
    if (field) {
      if (field.dataType !== condition.dataType) patch.dataType = field.dataType;
      if (field.elementType !== condition.elementType) patch.elementType = field.elementType;
    }
    if (condition.operator && !operatorValid) {
      patch.operator = ops[0]?.op ?? "";
      patch.value = "";
    }
    if (Object.keys(patch).length > 0) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineId, field?.dataType, field?.elementType, field?.kind, operatorValid]);

  function onField(path: string) {
    const f = schema.find((s) => s.path === path);
    const dataType = f?.dataType ?? "string";
    const elementType = f?.elementType;
    const kind = f?.kind ?? "jsonb";
    const nextOps = engine.operators(dataType, elementType, kind);
    onChange({ field: path, dataType, elementType, operator: nextOps[0]?.op ?? "", value: "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FieldCombobox
        ariaLabel="field"
        value={condition.field}
        options={fields.map((f) => f.path)}
        onCommit={(path) => {
          if (path && !schema.some((s) => s.path === path)) onCreateField(path);
          onField(path);
        }}
      />
      {condition.field ? (
        <span className={`font-mono text-[10px] ${dataTypeColor(dataType)}`}>{dataType}</span>
      ) : null}
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
        <span className="text-xs text-muted-foreground">{labels.elemMatch}</span>
      ) : (
        <ValueEditor
          dataType={dataType === "array" ? (elementType ?? "string") : dataType}
          arity={arity}
          value={condition.value}
          onChange={(v) => onChange({ value: v })}
        />
      )}
      <Button size="sm" variant="ghost" aria-label={labels.removeCondition} onClick={onRemove}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
```
> 變更只有「`useTranslations` → `labels` props」「`LOGIC_LABELS` 常數 → `labels.logic`」「aria remove* → `labels.*`」「`GroupNode` 改名 `FilterTreeEditor`」「colors/field-combobox/value-editor 改相對 import」。其餘邏輯(operator 調和、onField、colors)**一字不改**。

- [ ] **Step 3:建 `src/use-filter-tree.ts`**:
```ts
import { useState } from "react";

import { addInferredField, emptyGroup } from "@rfjs/filter-builder";
import type { BuilderGroup, FieldSchema } from "@rfjs/filter-builder";

const id = () => crypto.randomUUID();

export function useFilterTree(init?: { tree?: BuilderGroup; schema?: FieldSchema[] }): {
  tree: BuilderGroup;
  schema: FieldSchema[];
  setTree: (g: BuilderGroup) => void;
  setSchema: (s: FieldSchema[]) => void;
  createField: (path: string) => void;
} {
  const [tree, setTree] = useState<BuilderGroup>(() => init?.tree ?? emptyGroup(id));
  const [schema, setSchema] = useState<FieldSchema[]>(() => init?.schema ?? []);
  const createField = (path: string) => setSchema((s) => addInferredField(s, path));
  return { tree, schema, setTree, setSchema, createField };
}
```
> 確認 `@rfjs/filter-builder` 有 export `emptyGroup` 與 `addInferredField`(目前 barrel 有)。

- [ ] **Step 4:barrel `src/index.ts`**:
```ts
export * from "./filter-tree-editor";
export * from "./use-filter-tree";
export * from "./colors";
export * from "./field-combobox";
export * from "./value-editor";
```

- [ ] **Step 5:測試**(co-located):
  - `src/use-filter-tree.spec.ts`:用 `@testing-library/react` 的 `renderHook` 測 `createField` 串接 `addInferredField`、`setTree`/`setSchema` 改值。
  - `src/filter-tree-editor.spec.tsx`:render `<FilterTreeEditor>` 帶最小 `labels`,斷言:logic `<select>` 顯示 `labels.logic` 文字;按「addCondition」呼叫 `onChange`;`elemMatch` 文字來自 `labels`。(免 i18n provider,labels 走 props。)

  測試用的最小 labels 範例:
```ts
const labels = {
  logic: { and: "AND", or: "OR", nor: "NOR", not: "NOT" },
  addCondition: "+cond", addGroup: "+group",
  removeGroup: "rm group", removeCondition: "rm cond", elemMatch: "elemmatch",
};
```

- [ ] **Step 6:** `pnpm -F @rfjs/filter-builder-ui vitest:run && pnpm -F @rfjs/filter-builder-ui check-types`(全綠;若 filter-builder dist 缺,先 `pnpm build:packages`)。

- [ ] **Step 7:Commit**
```bash
git add packages/filter-builder-ui/src
git commit -m "feat(filter-builder-ui): FilterTreeEditor (labels-as-props) + useFilterTree + colors"
```

---

## Task 3:apps/web 薄消費 + 刪原檔(行為不變)

**Files:** modify `apps/web/src/tools/query-builder/ui/index.tsx`;delete `ui/builder-tree.tsx`、`ui/field-combobox.tsx`、`ui/value-editor.tsx`、`logic/colors.ts`、`logic/colors.spec.ts`。

- [ ] **Step 1:改 `ui/index.tsx`**
  - import 從套件取:`import { FilterTreeEditor, type FilterTreeLabels } from "@rfjs/filter-builder-ui";`(若改用 `useFilterTree` 一併 import;**最小改動**可只換 `GroupNode`→`FilterTreeEditor` + 傳 `labels`,樹狀態維持現有 inline,降低回歸風險)。
  - 移除對 `./builder-tree` 的 import。
  - 用既有 `useTranslations("ToolUI")` 組 `labels`(保留現行字面值,行為不變):
```tsx
  const labels: FilterTreeLabels = {
    logic: { and: "全部成立 / All", or: "擇一成立 / Any", nor: "皆不成立 / None", not: "非全部 / Not all" },
    addCondition: "+ 條件",
    addGroup: "+ 群組",
    removeGroup: "remove group",
    removeCondition: "remove condition",
    elemMatch: t("elemMatchPlaceholder"),
  };
```
  - 把原本 `<GroupNode group={tree} engineId={engineId} schema={schema} onChange={setTree} onCreateField={...} />` 換成 `<FilterTreeEditor ... labels={labels} />`(props 同名,加 `labels`)。
  > 這些 logic 字面值原本就 hardcode 在 builder-tree(非 locale 感知),照搬即行為不變。`removeGroup/removeCondition` 原本 aria 是 "remove group"/"remove condition",照舊。

- [ ] **Step 2:刪原檔**
```bash
cd apps/web/src/tools/query-builder
git rm ui/builder-tree.tsx ui/field-combobox.tsx ui/value-editor.tsx logic/colors.ts logic/colors.spec.ts
```
（若 `value-editor`/`field-combobox` 有 co-located spec 也一併 `git rm`。回 worktree root。）

- [ ] **Step 3:驗證 apps/web 綠**
Run: `pnpm -F web vitest:run && pnpm -F web check-types && pnpm -F web build`
Expected:query-builder 既有測試 + 其餘全綠;check-types 乾淨;build + SSG 成功。**這就是行為不變的守門**。若有 import 殘留(`./builder-tree`/`logic/colors`),修正後再跑。

- [ ] **Step 4:Commit**
```bash
git add apps/web pnpm-lock.yaml
git commit -m "refactor(web/query-builder): consume @rfjs/filter-builder-ui FilterTreeEditor"
```

---

## Task 4:全域驗證

- [ ] **Step 1:** `pnpm -w build`(含新套件;web SSG 成功)
- [ ] **Step 2:** `pnpm -w test`(全綠)
- [ ] **Step 3:** `pnpm -F @rfjs/filter-builder-ui check-types && pnpm -F web check-types`(乾淨;`pnpm -w typecheck` 若浮出既有 orm-app 失敗,確認本案未動 orm 檔)
- [ ] **Step 4:Sanity:** `grep -rn "query-builder/ui/builder-tree\|query-builder/logic/colors" apps/web/src || echo clean`(應 clean)

---

## Self-Review(plan 對 spec)
- 私有套件、無 build、transpilePackages、labels-as-props → Task 1/2 ✅
- FilterTreeEditor(labels)+ useFilterTree + colors + field-combobox + value-editor → Task 2 ✅
- apps/web 薄消費、刪原檔、行為不變(既有測試守門)→ Task 3 ✅
- 窄抽取(playground 面板留 web)→ 計畫未搬它們 ✅
- 全域驗證 → Task 4 ✅
- 風險:vitest 需 jsdom(component test)→ Task 1 Step 3 標注;labels 字面值照搬保行為 → Task 3 Step 1;build 型態照 web-ui → Task 1。
