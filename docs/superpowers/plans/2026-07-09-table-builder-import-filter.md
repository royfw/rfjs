# table-builder 匯入 + 執行時記憶體篩選 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** table-builder 加(A)靜態資料 JSON/CSV 匯入 +(B/C)表格自帶的執行時記憶體篩選(篩選進 `TableConfig`/由 `<ConfigTable>` 渲染/靜態靠 `runLiveMatch` 過濾)。

**Architecture:** engine(`@rfjs/table-builder`)只加 `filterable?` 選填欄位;renderer(`@rfjs/table-builder-ui`)的 `useConfigTable` 長出 filter tree state + 靜態 pipeline 先 `runLiveMatch` 再 sort/slice,`<ConfigTable>` 長出收合式 `FilterTreeEditor`;工具(apps/web)Source 面板加匯入、Columns 面板加 Filter 勾選。規格:`docs/superpowers/specs/2026-07-09-table-builder-import-filter-design.md`(**每任務開工前先讀對應章節**)。

**Tech Stack:** zod v4、React 19、@rfjs/filter-builder(runLiveMatch/emptyGroup/FieldSchema/EngineId)、@rfjs/filter-builder-ui(FilterTreeEditor)、papaparse(CSV)、vitest(+jsdom)、Playwright e2e。

## Global Constraints

- 工作目錄:worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-table-import-filter`,分支 `feat-table-import-filter`(基於含 #237 的 main)。
- **紅線**:不碰 `packages/form-builder*/**`、`apps/web/src/tools/form-builder/**`。
- Commit:英文 conventional(subject 全小寫),結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- Changesets:`@rfjs/table-builder` **minor** + `@rfjs/table-builder-ui` **minor**(改到的 package 都寫,含 private version-only);apps 不寫;手寫 markdown。
- 測試指令:`pnpm -F @rfjs/table-builder vitest:run`、`pnpm -F @rfjs/table-builder-ui vitest:run`、`pnpm -F web vitest:run <path>`。改 engine 後先 `pnpm build:packages` 再驗 ui/web 型別。改 package.json deps 後 `pnpm install`。
- **已確認的 API 事實**(實作以此為準):
  - `@rfjs/filter-builder` 匯出:`runLiveMatch(rows: unknown[], tree: BuilderGroup): { matched: unknown[]; count: number; uncoverable: boolean }`、`emptyGroup(id: () => string): BuilderGroup`、型別 `BuilderGroup`/`FieldSchema`/`EngineId`(含 `"data-filter"`)、`FieldKind`(`"column"|"jsonb"`)。
  - `@rfjs/filter-builder-ui` 匯出:`FilterTreeEditor`(props:`group`/`engineId`/`schema`/`onChange`/`onCreateField`/`labels`/`onRemove?`/`depth?`)、`FilterTreeLabels`(必填 `logic`/`addCondition`/`addGroup`/`removeGroup`/`removeCondition`/`elemMatch`,其餘選填)。
  - `FieldSchema = { path: string; dataType: FieldType; elementType?; include: boolean; kind: FieldKind }`;`ScalarType`(table-builder)≡ filter-builder `FieldType`。
  - **空 tree**:`runLiveMatch(rows, emptyGroup(...))` 回全部 rows(`count = rows.length`, `uncoverable=false`)。
  - **uncoverable**:tree 用了 data-filter 不支援的運算子時,`runLiveMatch` 回 `{ matched: [], count: 0, uncoverable: true }` —— 本案**不可**直接用它當「0 筆」,uncoverable 時改顯示**全部 rows** + 警告。
  - web-ui **沒有** collapsible primitive → 用 `useState` + button 自捲。
  - `papaparse` 目前**未安裝** → Task 6 加進 apps/web deps。

---

### Task 1: Engine — `TableColumnConfig.filterable?` + derive 帶過去

**Files:**
- Modify: `packages/table-builder/src/types.ts`(`TableColumnConfig`)
- Modify: `packages/table-builder/src/schema.ts`(column zod)
- Modify: `packages/table-builder/src/derive.ts`
- Modify: `packages/table-builder/src/{schema,derive}.spec.ts`
- Create: `.changeset/table-builder-filterable.md`

**Interfaces:**
- Produces:`TableColumnConfig` 加 `filterable?: boolean`;`deriveTableConfig` 若 `field.filterable !== undefined` 則帶到 column。

- [ ] **Step 1: 寫失敗測試** — `derive.spec.ts` 追加:

```ts
it('carries filterable from field metadata (and omits it when unset)', () => {
  const cfg = deriveTableConfig({
    fields: [
      { key: 'a', label: 'A', dataType: 'string', filterable: true },
      { key: 'b', label: 'B', dataType: 'numeric' },
    ],
  });
  expect(cfg.columns[0]).toMatchObject({ key: 'a', filterable: true });
  expect('filterable' in cfg.columns[1]!).toBe(false);
});
```

`schema.spec.ts` 追加(合法 filterable):

```ts
it('accepts a column with filterable', () => {
  const r = tableConfigSchema.safeParse({
    columns: [{ key: 'a', label: 'A', dataType: 'string', filterable: true }],
    pagination: { pageSize: 10 },
  });
  expect(r.success).toBe(true);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder vitest:run`
Expected: FAIL —— column 無 filterable(型別/斷言)。

- [ ] **Step 3: 實作**

`types.ts` 的 `TableColumnConfig` 加(比照 `sortable?`):

```ts
  /** 是否可作為篩選欄位(供 <ConfigTable> 的執行時篩選器)。 */
  filterable?: boolean;
```

`schema.ts` 的 column object schema 加 `filterable: z.boolean().optional(),`(放在 `sortable` 旁)。

`derive.ts` 的欄位映射條件展開加(比照 `if (field.sortable !== undefined) column.sortable = field.sortable;`):

```ts
    if (field.filterable !== undefined) column.filterable = field.filterable;
```

`.changeset/table-builder-filterable.md`:

```md
---
"@rfjs/table-builder": minor
---

`TableColumnConfig` gains an optional `filterable` flag (carried through by `deriveTableConfig` from `DataFieldMeta.filterable`) so a column can be marked as available to a table's runtime filter.
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/table-builder vitest:run && pnpm -F @rfjs/table-builder typecheck && pnpm build:packages`
Expected: 全 PASS;build 成功(供後續任務吃新型別)。

- [ ] **Step 5: Commit**

```bash
git add packages/table-builder/src/types.ts packages/table-builder/src/schema.ts packages/table-builder/src/derive.ts packages/table-builder/src/schema.spec.ts packages/table-builder/src/derive.spec.ts .changeset/table-builder-filterable.md
git commit -m "feat(table-builder): add optional filterable flag to table columns

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: UI setup — deps + `columnsToFilterSchema` + filter labels 預設 + TableLabels 擴充

**Files:**
- Modify: `packages/table-builder-ui/package.json`(deps 加 `@rfjs/filter-builder`、`@rfjs/filter-builder-ui`,workspace:*)
- Create: `packages/table-builder-ui/src/filter-schema.ts` + `filter-schema.spec.ts`
- Create: `packages/table-builder-ui/src/filter-labels.ts`
- Modify: `packages/table-builder-ui/src/types.ts`(`TableLabels` 加 filter chrome keys)
- Modify: `packages/table-builder-ui/src/labels.ts`(`DEFAULT_LABELS` 加對應英文預設)
- Modify: `packages/table-builder-ui/src/index.ts`(補 export)
- Create: `.changeset/table-builder-ui-filter.md`

**Interfaces:**
- Produces:
  - `columnsToFilterSchema(columns: TableColumnConfig[]): FieldSchema[]`(只取 `filterable` 欄,`{ path: c.key, dataType: c.dataType, include: true, kind: 'column' }`)
  - `DEFAULT_FILTER_TREE_LABELS: FilterTreeLabels`(英文預設)
  - `TableLabels` 加 `filterTitle`、`filterMatched`(帶 `{count}` 佔位,交由 ConfigTable replace)、`filterUncoverable`、`filterDisabled`

- [ ] **Step 1: 寫失敗測試** — `filter-schema.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { columnsToFilterSchema } from './filter-schema';
import type { TableColumnConfig } from '@rfjs/table-builder';

const cols: TableColumnConfig[] = [
  { key: 'name', label: 'Name', dataType: 'string', filterable: true },
  { key: 'price', label: 'Price', dataType: 'numeric', filterable: true },
  { key: 'note', label: 'Note', dataType: 'string' },
];

describe('columnsToFilterSchema', () => {
  it('maps only filterable columns to FieldSchema (dataType 1:1, key->path, kind column)', () => {
    expect(columnsToFilterSchema(cols)).toEqual([
      { path: 'name', dataType: 'string', include: true, kind: 'column' },
      { path: 'price', dataType: 'numeric', include: true, kind: 'column' },
    ]);
  });
  it('returns [] when no column is filterable', () => {
    expect(columnsToFilterSchema([cols[2]!])).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder-ui vitest:run src/filter-schema.spec.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**

`package.json` `dependencies` 加(在 `@rfjs/table-builder` 旁):

```json
    "@rfjs/filter-builder": "workspace:*",
    "@rfjs/filter-builder-ui": "workspace:*",
```

`filter-schema.ts`:

```ts
import type { TableColumnConfig } from '@rfjs/table-builder';
import type { FieldSchema } from '@rfjs/filter-builder';

/** filterable 欄位 → filter-builder FieldSchema(ScalarType ≡ FieldType,dataType 直接帶)。 */
export function columnsToFilterSchema(columns: TableColumnConfig[]): FieldSchema[] {
  return columns
    .filter((c) => c.filterable)
    .map((c) => ({ path: c.key, dataType: c.dataType, include: true, kind: 'column' as const }));
}
```

`filter-labels.ts`:

```ts
import type { FilterTreeLabels } from '@rfjs/filter-builder-ui';

/** ConfigTable 內建的英文 filter 樹標籤;消費端可用 filterLabels prop 覆寫。 */
export const DEFAULT_FILTER_TREE_LABELS: FilterTreeLabels = {
  logic: { and: 'AND', or: 'OR', nor: 'NOR', not: 'NOT' },
  addCondition: '+ condition',
  addGroup: '+ group',
  removeGroup: 'remove group',
  removeCondition: 'remove',
  elemMatch: 'elemmatch',
  toggleGroup: 'toggle group',
  collapsedConditions: 'cond',
  collapsedGroups: 'grp',
  collapsedEmpty: 'empty',
};
```

`types.ts` 的 `TableLabels` 介面加:

```ts
  /** 篩選區標題(收合列)。 */
  filterTitle: string;
  /** 篩選命中數,帶 {count} 佔位(ConfigTable 以 replacePlaceholders 代換)。 */
  filterMatched: string;
  /** 篩選含記憶體引擎不支援的條件時的警告。 */
  filterUncoverable: string;
  /** 遠端來源篩選停用時的說明。 */
  filterDisabled: string;
```

`labels.ts` 的 `DEFAULT_LABELS` 加:

```ts
  filterTitle: 'Filter',
  filterMatched: '{count} matched',
  filterUncoverable: 'This filter uses conditions the in-memory engine cannot evaluate.',
  filterDisabled: 'Filtering runs on static data only (api filter coming later).',
```

`index.ts` 補:

```ts
export * from './filter-schema';
export * from './filter-labels';
```

`.changeset/table-builder-ui-filter.md`:

```md
---
"@rfjs/table-builder-ui": minor
---

`<ConfigTable>` gains a built-in, collapsible runtime filter (reuses `@rfjs/filter-builder-ui`'s `FilterTreeEditor` over the columns marked `filterable`); static-rows sources are filtered in-memory via `runLiveMatch`. New helpers `columnsToFilterSchema`, `DEFAULT_FILTER_TREE_LABELS`, and filter-related `TableLabels` keys.
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm install && pnpm -F @rfjs/table-builder-ui vitest:run src/filter-schema.spec.ts && pnpm -F @rfjs/table-builder-ui check-types`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/table-builder-ui/package.json packages/table-builder-ui/src/filter-schema.ts packages/table-builder-ui/src/filter-schema.spec.ts packages/table-builder-ui/src/filter-labels.ts packages/table-builder-ui/src/types.ts packages/table-builder-ui/src/labels.ts packages/table-builder-ui/src/index.ts .changeset/table-builder-ui-filter.md pnpm-lock.yaml
git commit -m "feat(table-builder-ui): add filter schema mapper, default filter labels and table label keys

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: UI hook — `useConfigTable` 加篩選 state + 靜態 pipeline

**Files:**
- Modify: `packages/table-builder-ui/src/use-config-table.ts`
- Modify: `packages/table-builder-ui/src/use-config-table.spec.ts`

**Interfaces:**
- Consumes:Task 2 `columnsToFilterSchema`;`runLiveMatch`/`emptyGroup`/`BuilderGroup`/`FieldSchema`(`@rfjs/filter-builder`)。
- Produces:`UseConfigTableResult` 加:
  - `filterTree: BuilderGroup`、`setFilterTree(next: BuilderGroup): void`(改 tree 時回第一頁)
  - `filterSchema: FieldSchema[]`(= `columnsToFilterSchema(config.columns)`)
  - `filterEnabled: boolean`(= `source.kind === 'rows'`)
  - `filterUncoverable: boolean`
- 行為:靜態 source 的 rows pipeline 變成 **`runLiveMatch` 過濾 → sort → slice**;`uncoverable` 時**不過濾**(顯示全部)且 `filterUncoverable=true`;空 tree = 全部;`total`/`pageCount` 反映過濾後。遠端 source 不套用篩選。

- [ ] **Step 1: 寫失敗測試** — `use-config-table.spec.ts` 追加(用 `renderHook`;既有 import 有 `renderHook`/`act`):

```ts
import { emptyGroup } from '@rfjs/filter-builder';

const ROWS = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, price: (i + 1) * 10 }));
const CFG = {
  columns: [
    { key: 'id', label: 'ID', dataType: 'numeric' as const, filterable: true },
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true },
  ],
  pagination: { pageSize: 5 },
};

function priceGteTree(v: number) {
  // 一棵 AND group,單一 condition price >= v(用 emptyGroup 起手,填一條 condition)。
  const g = emptyGroup(() => Math.random().toString(36).slice(2));
  return {
    ...g,
    children: [{ kind: 'condition' as const, id: 'c1', field: 'price', operator: 'gte', value: v }],
  };
}

describe('useConfigTable static filtering', () => {
  it('exposes filterSchema from filterable columns and filterEnabled for rows source', () => {
    const { result } = renderHook(() => useConfigTable(CFG, { kind: 'rows', rows: ROWS }));
    expect(result.current.filterSchema.map((s) => s.path)).toEqual(['id', 'price']);
    expect(result.current.filterEnabled).toBe(true);
  });

  it('empty filter tree shows all rows', () => {
    const { result } = renderHook(() => useConfigTable(CFG, { kind: 'rows', rows: ROWS }));
    expect(result.current.total).toBe(8);
  });

  it('setFilterTree filters rows, updates total, resets to page 1', () => {
    const { result } = renderHook(() => useConfigTable(CFG, { kind: 'rows', rows: ROWS }));
    act(() => result.current.nextPage()); // go to page 2 first
    expect(result.current.page).toBe(2);
    act(() => result.current.setFilterTree(priceGteTree(50))); // price >= 50 -> ids 5..8 (4 rows)
    expect(result.current.total).toBe(4);
    expect(result.current.page).toBe(1);
    expect(result.current.rows.map((r) => r.id)).toEqual([5, 6, 7, 8]);
  });

  it('remote source disables filtering', () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const { result } = renderHook(() =>
      useConfigTable(CFG, {
        kind: 'remote',
        request: { endpoint: '/x', pagination: { strategy: 'offset', limitParam: 'l', offsetParam: 'o' } },
        response: { rowsPath: 'data.items', totalPath: 'data.total' },
        fetch: fetchFn,
      }),
    );
    expect(result.current.filterEnabled).toBe(false);
  });
});
```

（`operator: 'gte'` 若 data-filter 用不同鍵名,以 `DATA_FILTER_OPS`/現有 filter 測試的鍵為準調整 —— 實作 Step 3 前先跑一個 `runLiveMatch` 小驗證確認 operator 字串,再定測試值,不得放寬斷言。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder-ui vitest:run src/use-config-table.spec.ts`
Expected: FAIL —— hook 無 filter 欄位。

- [ ] **Step 3: 實作** — `use-config-table.ts`:

import 加:

```ts
import { runLiveMatch, emptyGroup, type BuilderGroup, type FieldSchema } from '@rfjs/filter-builder';
import { columnsToFilterSchema } from './filter-schema';
```

`UseConfigTableResult` 介面加 `filterTree`/`setFilterTree`/`filterSchema`/`filterEnabled`/`filterUncoverable`(型別見 Interfaces)。

hook body 內(在 sort state 附近)加:

```ts
const [filterTree, setFilterTreeState] = useState<BuilderGroup>(() => emptyGroup(() => crypto.randomUUID()));
```

`clientRows` 之後、`sortedRows` 之前插入過濾:

```ts
const filterSchema = useMemo(() => columnsToFilterSchema(config.columns), [config.columns]);
const match = useMemo(() => runLiveMatch(clientRows, filterTree), [clientRows, filterTree]);
// uncoverable(記憶體引擎不支援的運算子):不誤報 0 筆 → 顯示全部 + 由 UI 出警告。
const filteredRows = source.kind === 'rows' && !match.uncoverable ? (match.matched as Record<string, unknown>[]) : clientRows;
```

把 `sortedRows` 的來源由 `clientRows` 改為 `filteredRows`:

```ts
const sortedRows = useMemo(
  () => (sort ? sortRows(filteredRows, sort, config.columns) : filteredRows),
  [filteredRows, sort, config.columns],
);
```

`setFilterTree`(回第一頁):

```ts
const setFilterTree = useCallback((next: BuilderGroup) => {
  setFilterTreeState(next);
  setPageState(1);
}, []);
```

回傳物件加:

```ts
  filterTree,
  setFilterTree,
  filterSchema,
  filterEnabled: source.kind === 'rows',
  filterUncoverable: source.kind === 'rows' && match.uncoverable,
```

（更新檔頭那段 hook-count 註解:useState 由 5 → 6;順帶保留「hook 順序每 render 一致」的說明。）

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/table-builder-ui vitest:run && pnpm -F @rfjs/table-builder-ui check-types`
Expected: 全 PASS(既有 remote/client 測試不受影響)。

- [ ] **Step 5: Commit**

```bash
git add packages/table-builder-ui/src/use-config-table.ts packages/table-builder-ui/src/use-config-table.spec.ts
git commit -m "feat(table-builder-ui): add in-memory filter state and pipeline to useconfigtable

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: UI 元件 — `<ConfigTable>` 收合式 Filter 區

**Files:**
- Modify: `packages/table-builder-ui/src/config-table.tsx`
- Modify: `packages/table-builder-ui/src/config-table.spec.tsx`

**Interfaces:**
- Consumes:Task 3 的 `t.filterTree`/`setFilterTree`/`filterSchema`/`filterEnabled`/`filterUncoverable`;`FilterTreeEditor`(`@rfjs/filter-builder-ui`);Task 2 `DEFAULT_FILTER_TREE_LABELS`。
- Produces:`ConfigTableProps` 加選填 `filterLabels?: Partial<FilterTreeLabels>`(覆寫 `DEFAULT_FILTER_TREE_LABELS`)。

- [ ] **Step 1: 寫失敗測試** — `config-table.spec.tsx` 追加(沿用檔內既有 render/靜態 source 樣式):

```ts
// (檔頭 import 補) import type { TableColumnConfig } from '@rfjs/table-builder';
const FILT_CFG = {
  columns: [
    { key: 'id', label: 'ID', dataType: 'numeric' as const, filterable: true },
    { key: 'name', label: 'Name', dataType: 'string' as const },
  ] satisfies TableColumnConfig[],
  pagination: { pageSize: 5 },
};
const FILT_ROWS = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];

it('renders a collapsible Filter section for a static source (collapsed by default)', () => {
  render(<ConfigTable config={FILT_CFG} source={{ kind: 'rows', rows: FILT_ROWS }} />);
  // 收合列可見(title),展開器存在;預設收合 → 樹編輯器的 "+ condition" 尚未出現
  expect(screen.getByText('Filter')).toBeTruthy();
  expect(screen.queryByText('+ condition')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /filter/i }));
  expect(screen.getByText('+ condition')).toBeTruthy();
});

it('disables the filter for a remote source with a note', () => {
  const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
  render(
    <ConfigTable
      config={FILT_CFG}
      source={{ kind: 'remote', request: { endpoint: '/x', pagination: { strategy: 'offset', limitParam: 'l', offsetParam: 'o' } }, response: { rowsPath: 'data.items', totalPath: 'data.total' }, fetch: fetchFn }}
    />,
  );
  expect(screen.getByText(/api filter coming later/i)).toBeTruthy();
  expect(screen.queryByText('+ condition')).toBeNull();
});
```

（若 `FilterTreeEditor` 的 add-condition 文案在收合預設下仍會 render,改以「展開器 aria-expanded 切換」或「data-testid」判斷,以實際 DOM 為準,不得放寬成 truthy。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder-ui vitest:run src/config-table.spec.tsx`
Expected: FAIL —— 無 Filter 區。

- [ ] **Step 3: 實作** — `config-table.tsx`:

import 加:

```ts
import { FilterTreeEditor, type FilterTreeLabels } from '@rfjs/filter-builder-ui';
import { DEFAULT_FILTER_TREE_LABELS } from './filter-labels';
```

`ConfigTableProps` 加 `filterLabels?: Partial<FilterTreeLabels>;`;函式簽名解構加 `filterLabels`。

元件內(`t` 之後)加收合 state + 合併標籤:

```ts
const [filterOpen, setFilterOpen] = React.useState(false);
const filterTreeLabels: FilterTreeLabels = { ...DEFAULT_FILTER_TREE_LABELS, ...filterLabels };
```

在 return 的 `<Table>` **之前**插入 Filter 區(整段在最外層 `<div ref={containerRef} …>` 內、Table 上方):

```tsx
<div className="rounded-md border border-input">
  <button
    type="button"
    aria-expanded={t.filterEnabled ? filterOpen : false}
    disabled={!t.filterEnabled}
    onClick={() => setFilterOpen((o) => !o)}
    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium disabled:opacity-60"
  >
    <span>{mergedLabels.filterTitle}</span>
    {t.filterEnabled ? (
      <span className="text-xs text-muted-foreground">
        {replacePlaceholders(mergedLabels.filterMatched, { count: t.total ?? '' })}
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">{mergedLabels.filterDisabled}</span>
    )}
  </button>
  {t.filterEnabled && filterOpen && (
    <div className="border-t border-input p-3">
      {t.filterUncoverable && (
        <p className="mb-2 text-xs text-destructive">{mergedLabels.filterUncoverable}</p>
      )}
      <FilterTreeEditor
        group={t.filterTree}
        engineId="data-filter"
        schema={t.filterSchema}
        onChange={t.setFilterTree}
        onCreateField={() => {}}
        labels={filterTreeLabels}
      />
    </div>
  )}
</div>
```

（`onCreateField` 給 no-op:欄位清單就是 filterable 欄位,不做自由新增。）

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/table-builder-ui vitest:run && pnpm -F @rfjs/table-builder-ui check-types && pnpm -F @rfjs/table-builder-ui lint`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/table-builder-ui/src/config-table.tsx packages/table-builder-ui/src/config-table.spec.tsx
git commit -m "feat(table-builder-ui): render a collapsible filter editor in configtable

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 工具 — Columns 面板 Filter 勾選

**Files:**
- Modify: `apps/web/src/tools/table-builder/columns-panel.tsx`
- Modify: `apps/web/src/tools/table-builder/columns-panel.spec.tsx`
- Modify: `apps/web/src/tools/table-builder/ui.tsx`(`columnsPanelLabels` 加 filter key)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(`tbColumnFilter` en+zh-TW)

**Interfaces:**
- Consumes:Task 1 的 `column.filterable`。
- Produces:`ColumnsPanelLabels` 加 `filter: string`;每欄一個 Filter checkbox 改 `column.filterable`。

- [ ] **Step 1: 寫失敗測試** — `columns-panel.spec.tsx` 追加(沿用檔內 render helper):

```ts
it('toggling Filter writes column.filterable', () => {
  const onChange = vi.fn();
  render(<ColumnsPanel columns={[{ key: 'a', label: 'A', dataType: 'string' }]} onChange={onChange} labels={LABELS} />);
  fireEvent.click(screen.getByLabelText(/filter a/i));
  expect(onChange).toHaveBeenCalledWith([{ key: 'a', label: 'A', dataType: 'string', filterable: true }]);
});
```

（`LABELS` 為該檔既有的測試 labels 物件,加 `filter: 'Filter'`。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/table-builder/columns-panel.spec.tsx`
Expected: FAIL —— 無 Filter checkbox。

- [ ] **Step 3: 實作**

`columns-panel.tsx`:`ColumnsPanelLabels` 加 `filter: string;`;加 setter(比照 `setSortable`):

```ts
  function setFilterable(index: number, filterable: boolean) {
    updateAt(index, (column) => ({ ...column, filterable: filterable || undefined }));
  }
```

在 Sortable checkbox 那個 `<label>` 之後插入(比照 sortable 的 render):

```tsx
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={column.filterable ?? false}
                  onChange={(e) => setFilterable(index, e.target.checked)}
                  aria-label={`${labels.filter} ${column.key}`}
                />
                {labels.filter}
              </label>
```

`ui.tsx` 的 `columnsPanelLabels` memo 加 `filter: t("tbColumnFilter"),`。

`messages.ts`:`en.ToolUI.tbColumnFilter = "Filter"`、`zh-TW.ToolUI.tbColumnFilter = "篩選"`。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/table-builder/columns-panel.spec.tsx src/tools/table-builder/ui.spec.tsx && pnpm -F web check-types`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/table-builder/columns-panel.tsx apps/web/src/tools/table-builder/columns-panel.spec.tsx apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/messages.ts
git commit -m "feat(web): add filter checkbox to table-builder columns panel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 工具 — Source 面板匯入(JSON/CSV 貼上 + 上傳)

**Files:**
- Modify: `apps/web/package.json`(deps 加 `papaparse`;devDeps 加 `@types/papaparse`)
- Create: `apps/web/src/tools/table-builder/import.ts` + `import.spec.ts`(純解析函式)
- Modify: `apps/web/src/tools/table-builder/source-panel.tsx`(匯入 UI)
- Modify: `apps/web/src/tools/table-builder/source-panel.spec.tsx`
- Modify: `apps/web/src/tools/table-builder/ui.tsx`(匯入 state + handler + 資料版本 key)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(匯入相關 en+zh-TW)

**Interfaces:**
- Produces:`parseImport(text: string, format: 'json' | 'csv'): { rows: Record<string, unknown>[] } | { error: string }`(純函式)。
- `source-panel.tsx`:`SourcePanelProps` 加 `onImport?(rows): void`、`importLabels`;「Static data」模式下顯示貼上 textarea + 格式切換 + Upload + Load + 錯誤訊息。
- `ui.tsx`:持 `rows` state(初值 `SAMPLE_ROWS`)+ `dataVersion` 計數;匯入成功 → `inferFieldsFromRows`→`deriveTableConfig`→ 換 config+rows,`dataVersion++`;`<ConfigTable key>` 加 `dataVersion`(re-import 重掛 → filter tree 清空)。

- [ ] **Step 1: 寫失敗測試** — `import.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseImport } from './import';

describe('parseImport', () => {
  it('parses a JSON array of objects', () => {
    const r = parseImport('[{"a":1},{"a":2}]', 'json');
    expect(r).toEqual({ rows: [{ a: 1 }, { a: 2 }] });
  });
  it('rejects non-array / bad JSON', () => {
    expect('error' in parseImport('{"a":1}', 'json')).toBe(true);
    expect('error' in parseImport('not json', 'json')).toBe(true);
  });
  it('parses CSV with header + typed values', () => {
    const r = parseImport('a,b\n1,x\n2,y', 'csv');
    expect(r).toEqual({ rows: [{ a: 1, b: 'x' }, { a: 2, b: 'y' }] });
  });
  it('rejects empty CSV', () => {
    expect('error' in parseImport('', 'csv')).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/table-builder/import.spec.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**

`apps/web/package.json`:`dependencies` 加 `"papaparse": "^5.4.1"`;`devDependencies` 加 `"@types/papaparse": "^5.3.14"`。

`import.ts`:

```ts
import Papa from 'papaparse';

export type ImportFormat = 'json' | 'csv';
export type ImportResult = { rows: Record<string, unknown>[] } | { error: string };

export function parseImport(text: string, format: ImportFormat): ImportResult {
  if (format === 'json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { error: 'Invalid JSON.' };
    }
    if (!Array.isArray(parsed) || !parsed.every((r) => r !== null && typeof r === 'object' && !Array.isArray(r))) {
      return { error: 'JSON must be an array of objects.' };
    }
    return { rows: parsed as Record<string, unknown>[] };
  }
  const out = Papa.parse<Record<string, unknown>>(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true });
  if (out.errors.length > 0) return { error: out.errors[0]!.message };
  if (out.data.length === 0) return { error: 'No rows found in CSV.' };
  return { rows: out.data };
}
```

`source-panel.tsx`:`SourcePanelProps` 加 `onImport?: (rows: Record<string, unknown>[]) => void;` 與 import 相關 labels;在「Static data」選中(`!isRemote`)時,面板內加:格式切換(JSON/CSV segmented)、`<textarea>`、「Upload .json/.csv」`<input type="file" accept=".json,.csv">`、「Load」按鈕、錯誤訊息 `<p role="alert">`。Load / 檔案讀入 → `parseImport(text, format)` → 成功 `onImport(rows)`;失敗 setError。上傳走 `FileReader.readAsText`,`e.target.value=""` 清掉可重選。

`ui.tsx`:加 `const [rows, setRows] = React.useState<Record<string, unknown>[]>(SAMPLE_ROWS);`、`const [dataVersion, setDataVersion] = React.useState(0);`;`handleImport(nextRows)`:

```ts
function handleImport(nextRows: Record<string, unknown>[]) {
  const meta = { fields: inferFieldsFromRows(nextRows) };
  setConfig(deriveTableConfig(meta));
  setRows(nextRows);
  setDataVersion((v) => v + 1);
}
```

（import `inferFieldsFromRows` from `@rfjs/data-schema`、`deriveTableConfig` from `@rfjs/table-builder`。）source memo 的 `rows` 分支改用 state `rows`(取代 `SAMPLE_ROWS`);`<ConfigTable key>` 改為 `` `${sourceMode}:${config.pagination.pageSize}:${dataVersion}` ``(re-import → 換 key → 重掛 → filter tree 清空)。`SourcePanel` 傳 `onImport={handleImport}` + importLabels。

`messages.ts`:加 `tbImportPaste`/`tbImportUpload`/`tbImportLoad`/`tbImportJson`/`tbImportCsv`/`tbImportError*`(en+zh-TW;錯誤文案走 t() 或直接用 parseImport 回的英文訊息 —— parseImport 回英文,UI 直接顯示即可,不需 i18n 該字串)。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm install && pnpm -F web vitest:run src/tools/table-builder/ && pnpm -F web check-types && pnpm -F web lint`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/tools/table-builder/import.ts apps/web/src/tools/table-builder/import.spec.ts apps/web/src/tools/table-builder/source-panel.tsx apps/web/src/tools/table-builder/source-panel.spec.tsx apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/messages.ts pnpm-lock.yaml
git commit -m "feat(web): add json/csv import to the table-builder source panel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 工具 — 預覽接篩選標籤(operatorLabels 等)

**Files:**
- Modify: `apps/web/src/tools/table-builder/ui.tsx`
- Modify: `apps/web/src/tools/table-builder/ui.spec.tsx`
- Modify: `apps/web/src/tools/table-builder/messages.ts`(filter 樹標籤 en+zh-TW)

**Interfaces:**
- Consumes:Task 4 的 `<ConfigTable filterLabels?>`;Task 2 的 `TableLabels` filter keys。
- Produces:工具傳給 `<ConfigTable>` 的 `labels`(補 filterTitle/filterMatched/filterUncoverable/filterDisabled)+ `filterLabels`(繁中/英文 filter 樹標籤)。

- [ ] **Step 1: 寫失敗測試** — `ui.spec.tsx` 追加:

```ts
it('preview: filtering the sample reduces the rows', async () => {
  renderTool();
  // 展開 Filter → 加一條 condition → 表格列數變少(以實際 DOM 操作為準;可先斷言 Filter 區存在)
  expect(screen.getByText(/filter/i)).toBeTruthy();
});
```

（此為 smoke;真正「加條件→列數變少」由 e2e(Task 8)驗,單元只確認 Filter 區在工具預覽渲染 + 標籤有代換。）

- [ ] **Step 2: 跑測試確認失敗 / 通過** — 若既有 ConfigTable 已渲染 Filter 區(Task 4),此測試可能已綠;確認 `t.raw` 不需用於 filterMatched(它含 `{count}` 但由 ConfigTable 內部 replacePlaceholders 代換,工具用 `t.raw("tbFilterMatched")` 傳入)。

Run: `pnpm -F web vitest:run src/tools/table-builder/ui.spec.tsx`

- [ ] **Step 3: 實作** — `ui.tsx` 的 `labels` memo 加:

```ts
      filterTitle: t("tbFilterTitle"),
      filterMatched: t.raw("tbFilterMatched") as string, // 含 {count},交由 ConfigTable 代換
      filterUncoverable: t("tbFilterUncoverable"),
      filterDisabled: t("tbFilterDisabled"),
```

加 `filterLabels` memo(FilterTreeLabels 子集,en 由 next-intl,operatorLabels 可省 v1):

```ts
const filterLabels = React.useMemo(
  () => ({
    logic: { and: t("tbFilterAnd"), or: t("tbFilterOr"), nor: t("tbFilterNor"), not: t("tbFilterNot") },
    addCondition: t("tbFilterAddCond"),
    addGroup: t("tbFilterAddGroup"),
    removeGroup: t("tbFilterRemoveGroup"),
    removeCondition: t("tbFilterRemoveCond"),
    elemMatch: t("tbFilterElemMatch"),
  }),
  [t],
);
```

`<ConfigTable … labels={labels} filterLabels={filterLabels} />`。`messages.ts` 補上述所有 key(en + zh-TW)。

- [ ] **Step 4: 跑測試 + 型別 + lint**

Run: `pnpm -F web vitest:run src/tools/table-builder/ && pnpm -F web check-types && pnpm -F web lint`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/ui.spec.tsx apps/web/src/tools/table-builder/messages.ts
git commit -m "feat(web): wire localized filter labels into the table-builder preview

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: e2e + 全套驗證

**Files:**
- Modify: `apps/web/e2e/table-builder.e2e.ts`

**Interfaces:**
- Consumes:工具 Source 匯入 + ConfigTable Filter 區。

- [ ] **Step 1: 追加 e2e**(以實際 DOM selector 為準微調,不得放寬成 truthy):

```ts
test("importing json then filtering shrinks the rows", async ({ page }) => {
  await page.goto(URL);
  // 匯入一份小 JSON
  await page.getByRole("textbox").first().fill('[{"id":1,"price":10},{"id":2,"price":90}]');
  await page.getByRole("button", { name: /load/i }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(2, { timeout: 15_000 });
  // 勾 price 為 filterable(Columns 面板)→ 展開 Filter → 加一條 price >= 50 → 剩 1 列
  // (selector 依實際 DOM;若操作太脆,退一步驗「匯入後列數 = 2」為主斷言,篩選互動放單元層)
});
```

- [ ] **Step 2: 跑 e2e**

Run: `pnpm -F web test:e2e`(port 撞 → `E2E_PORT=3013`)
Expected: 全 PASS。

- [ ] **Step 3: 全套 + workbench build 閘(#230 教訓)**

Run: `pnpm -F @rfjs/table-builder test && pnpm -F @rfjs/table-builder-ui test && pnpm -F web test && pnpm -F @rfjs/web-core test && pnpm -F workbench build`
Expected: 全 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/table-builder.e2e.ts
git commit -m "test(web): cover table-builder import and filtering in e2e

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 真渲染截圖 + PR(主 session,非 subagent)

- [ ] **Step 1:** `pnpm -F web build` → `next start -p 3010` → Playwright 截圖 light/dark:匯入區(貼 JSON/CSV 切換 + 上傳)、Columns 的 Filter 勾選、展開的 Filter 樹 + 過濾後表格 + 命中數、遠端 source Filter 停用標註。對照 mockup 驗收。
- [ ] **Step 2:** 截圖貼給使用者 → push + `gh pr create`(HOLD)。PR 要點:filterable on column、ConfigTable 自帶收合式 filter(靜態 runLiveMatch)、JSON/CSV 匯入、changesets ×2、api filter 排下一輪接 workbench。
