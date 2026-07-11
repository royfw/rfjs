# api filter 第一輪(stack only)實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 ConfigTable 的篩選樹能編進 API 請求 —— `data-schema` 宣告 filter 契約、`table-builder-ui` 的 remote 來源解鎖篩選(Apply 觸發重抓)、web 工具的假 fetcher 真的執行 filter 示範全鏈路。

**Architecture:** 三層各補一塊:契約層加 `DataFieldMeta.kind` / `RequestMeta.filter` / `BuiltRequest.filter`(對 data-schema 不透明);UI 層用 `treeToPgFilterGroup`(filter-builder 既有)編譯篩選樹、Apply 後帶著 filter 重抓;示範層的假 fetcher 用 `filterGroupToTree` + `runLiveMatch`(既有 reverse 鏈)在記憶體執行 pg filter。全程不需 postgres。

**Tech Stack:** TypeScript、zod、React 19、Vitest + @testing-library/react、Playwright。

## Global Constraints

- 規格:`docs/superpowers/specs/2026-07-10-api-filter-stack-design.md`
- 工作目錄(worktree 根):`/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-api-filter` — **所有指令在此執行**
- 紅線:`packages/filter-builder/**`、`packages/table-builder/**`(引擎)、`apps/workbench/**`、form-builder 系 —— **零改動**
- `@rfjs/data-schema` 是 **dist 套件**:改完必須 `pnpm -F @rfjs/data-schema build`,否則 UI/工具層看不到新 export;`@rfjs/table-builder-ui` 走 transpilePackages 免建置
- `useConfigTable` 的 **hook 呼叫順序穩定守則**:所有 hook 無條件呼叫,source-kind 分支只在值/effect body 內 —— 不得早退、不得條件式 hook
- i18n:en 與 zh-TW 同步增鍵(`apps/web/src/i18n/messages.spec.ts` 檢查 parity)
- lint 是 `--max-warnings 0`;既有測試**不得刪弱**
- Changesets:`@rfjs/data-schema` minor、`@rfjs/table-builder-ui` minor(私有也要,版本紀錄用);apps 不寫
- Commit:conventional、subject 全小寫 ≤90 字元、trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;pre-commit hook 跑 `turbo run lint-staged test --affected`,失敗先讀輸出修好,**不可 --no-verify**
- 已知環境噪音:`@rfjs/db` lint 與 `@rfjs/form-builder` typecheck 在 main 上就壞(與本輪無關),全量檢查時忽略這兩項

---

### Task 1: 契約(`@rfjs/data-schema`)—— `kind` + `FilterRequestMeta` + `BuiltRequest.filter`

**Files:**
- Modify: `packages/data-schema/src/types.ts`(`DataFieldMeta`、`RequestMeta`、`BuiltRequest`)
- Modify: `packages/data-schema/src/schema.ts`(`dataFieldMetaObjectSchema`、新 `filterRequestMetaSchema`、`requestMetaSchema`)
- Modify: `packages/data-schema/src/request.ts`(`buildRequestParams` 第三參數)
- Test: `packages/data-schema/src/schema.spec.ts`、`packages/data-schema/src/request.spec.ts`(附加)
- Create: `.changeset/data-schema-filter-contract.md`

**Interfaces:**
- Consumes: 既有 `PageState`/`BuiltRequest`/`RequestMeta`
- Produces(後續 task 依賴):`DataFieldMeta.kind?: 'column' | 'jsonb'`;`FilterRequestMeta { style: 'pg'; param: string }`;`RequestMeta.filter?: FilterRequestMeta`;`BuiltRequest.filter?: unknown`;`buildRequestParams(request, state, filter?: unknown): BuiltRequest`

- [ ] **Step 1: 寫失敗測試**

`packages/data-schema/src/schema.spec.ts` 檔尾附加:

```ts
describe('filter contract (kind + FilterRequestMeta)', () => {
  it('accepts kind column/jsonb on a field and rejects other values', () => {
    const base = { key: 'price', label: 'Price', dataType: 'numeric' };
    expect(() => dataFieldMetaSchema.parse({ ...base, kind: 'column' })).not.toThrow();
    expect(() => dataFieldMetaSchema.parse({ ...base, kind: 'jsonb' })).not.toThrow();
    expect(() => dataFieldMetaSchema.parse({ ...base, kind: 'json' })).toThrow();
  });

  it('accepts request.filter with style pg and a non-empty param, rejects otherwise', () => {
    const base = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
    };
    expect(() => requestMetaSchema.parse({ ...base, filter: { style: 'pg', param: 'filter' } })).not.toThrow();
    expect(() => requestMetaSchema.parse({ ...base, filter: { style: 'sql', param: 'filter' } })).toThrow();
    expect(() => requestMetaSchema.parse({ ...base, filter: { style: 'pg', param: '' } })).toThrow();
  });
});
```

(該檔既有 import 若未含 `dataFieldMetaSchema`/`requestMetaSchema`,在檔頭 import 行補上。)

`packages/data-schema/src/request.spec.ts` 檔尾附加:

```ts
describe('buildRequestParams filter passthrough', () => {
  const requestWithFilter = {
    endpoint: '/api/items',
    pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
    filter: { style: 'pg', param: 'filter' },
  } as const;
  const group = { logic: 'and', filters: [{ target: 'column', column: 'price', operator: 'gte', value: 40 }] };

  it('attaches filter when the meta declares one and a filter value is given', () => {
    const built = buildRequestParams(requestWithFilter, { pageSize: 5 }, group);
    expect(built.filter).toEqual(group);
  });

  it('omits filter when the meta has no filter declaration', () => {
    const noFilterMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
    } as const;
    const built = buildRequestParams(noFilterMeta, { pageSize: 5 }, group);
    expect('filter' in built).toBe(false);
  });

  it('omits filter when no filter value is given (back-compat two-arg call)', () => {
    const built = buildRequestParams(requestWithFilter, { pageSize: 5 });
    expect('filter' in built).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/data-schema exec vitest run src/schema.spec.ts src/request.spec.ts`
Expected: **恰 3 條紅、2 條綠**。紅:schema 兩條(zod 預設 strip unknown key,`kind: 'json'`/`style: 'sql'`/`param: ''` 的 `.toThrow()` 不會拋)+ request 的 'attaches filter'(現行無第三參數,`built.filter` 為 undefined)。綠:兩條 'omits filter' 是 back-compat 守衛測試 —— 現行 `BuiltRequest` 本就沒有 filter 鍵,實作前即綠是**預期**,不要動它們,實作後必須保持綠。

- [ ] **Step 3: 實作**

`packages/data-schema/src/types.ts`:

(a) `DataFieldMeta` 內,`filterable` 行替換為:

```ts
  filterable?: boolean; // authored: whether this field may appear in a filter tree (remote filter consumer since the api-filter round)
  /**
   * How the backend queries this field: a typed SQL column or a JSONB path. Literals align with
   * `@rfjs/filter-builder`'s `FieldKind` (no cross-dependency — same convention as `ScalarType`).
   * Authored only — `inferFieldsFromRows` never produces it; absent = not remotely filterable.
   */
  kind?: 'column' | 'jsonb';
```

(b) `SortMeta` 之後、`RequestMeta` 之前加:

```ts
/** How a compiled filter rides the request: currently only the pg-filter tree style. */
export interface FilterRequestMeta {
  style: 'pg'; // room to grow (e.g. other encodings) without breaking the shape
  param: string; // request key: POST body key, or the query param a GET fetcher serializes into
}
```

(c) `RequestMeta` 內 `sort?: SortMeta;` 之後加:

```ts
  filter?: FilterRequestMeta;
```

(d) `BuiltRequest` 補:

```ts
export interface BuiltRequest {
  endpoint: string;
  method: 'GET' | 'POST';
  params: Record<string, string>;
  /** Compiled filter (opaque to data-schema); the fetcher places it per `RequestMeta.filter.param`. */
  filter?: unknown;
}
```

`packages/data-schema/src/schema.ts`:

(a) `dataFieldMetaObjectSchema` 的 `filterable` 行後加:

```ts
  kind: z.enum(['column', 'jsonb']).optional(),
```

(b) `sortMetaSchema` 之後加:

```ts
export const filterRequestMetaSchema = z.object({
  style: z.literal('pg'),
  param: z.string().min(1),
}) satisfies z.ZodType<FilterRequestMeta>;
```

(檔頭 type import 補 `FilterRequestMeta`。)

(c) `requestMetaSchema` 的 `sort` 行後加:

```ts
  filter: filterRequestMetaSchema.optional(),
```

`packages/data-schema/src/request.ts` —— 簽名與回傳改為:

```ts
export function buildRequestParams(request: RequestMeta, state: PageState, filter?: unknown): BuiltRequest {
```

檔尾 `return` 改為:

```ts
  const built: BuiltRequest = { endpoint: request.endpoint, method: request.method ?? 'GET', params };
  if (request.filter && filter !== undefined) built.filter = filter;
  return built;
```

- [ ] **Step 4: 跑測試 + 全套件 + rebuild**

Run: `pnpm -F @rfjs/data-schema exec vitest run src/schema.spec.ts src/request.spec.ts`
Expected: PASS(新增 5 條全綠)

Run: `pnpm -F @rfjs/data-schema vitest:run && pnpm -F @rfjs/data-schema build`
Expected: 全 PASS;build 成功(**後續 task 依賴這個 dist**)

- [ ] **Step 5: changeset**

`.changeset/data-schema-filter-contract.md`:

```md
---
"@rfjs/data-schema": minor
---

add the remote-filter contract: `DataFieldMeta.kind` ('column' | 'jsonb', authored only), `RequestMeta.filter` (`FilterRequestMeta { style: 'pg', param }`), and an opaque `BuiltRequest.filter` attached by `buildRequestParams(request, state, filter?)`
```

- [ ] **Step 6: Commit**

```bash
git add packages/data-schema/src/types.ts packages/data-schema/src/schema.ts packages/data-schema/src/request.ts packages/data-schema/src/schema.spec.ts packages/data-schema/src/request.spec.ts .changeset/data-schema-filter-contract.md
git commit -m "feat(data-schema): add remote filter contract (field kind, request filter meta, built filter)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `table-builder-ui` 契約接線 —— `TableSource.fields` + `fieldsToFilterSchema`

**Files:**
- Modify: `packages/table-builder-ui/src/types.ts`(remote variant 加 `fields`)
- Modify: `packages/table-builder-ui/src/filter-schema.ts`
- Test: `packages/table-builder-ui/src/filter-schema.spec.ts`(附加)
- Create: `.changeset/table-builder-ui-remote-filter.md`

**Interfaces:**
- Consumes: Task 1 的 `DataFieldMeta`(含 `kind`)—— 需 dist 已 rebuild
- Produces: `TableSource` remote variant 增 `fields?: DataFieldMeta[]`;`fieldsToFilterSchema(fields: DataFieldMeta[]): FieldSchema[]`(Task 3 用)

- [ ] **Step 1: 寫失敗測試**

`packages/table-builder-ui/src/filter-schema.spec.ts` 檔尾附加:

```ts
describe('fieldsToFilterSchema', () => {
  it('maps filterable fields with a kind, keeping dataType and kind', () => {
    const schema = fieldsToFilterSchema([
      { key: 'price', label: 'Price', dataType: 'numeric', filterable: true, kind: 'column' },
      { key: 'author.name', label: 'Author', dataType: 'string', filterable: true, kind: 'jsonb' },
    ]);
    expect(schema).toEqual([
      { path: 'price', dataType: 'numeric', include: true, kind: 'column' },
      { path: 'author.name', dataType: 'string', include: true, kind: 'jsonb' },
    ]);
  });

  it('drops fields that are not filterable or lack a kind', () => {
    const schema = fieldsToFilterSchema([
      { key: 'a', label: 'A', dataType: 'string', kind: 'column' }, // not filterable
      { key: 'b', label: 'B', dataType: 'string', filterable: true }, // no kind
      { key: 'c', label: 'C', dataType: 'string', filterable: false, kind: 'column' },
    ]);
    expect(schema).toEqual([]);
  });
});
```

(檔頭 import 行補 `fieldsToFilterSchema`;fixtures 需要 `import type { DataFieldMeta } from '@rfjs/data-schema';` 時一併補 —— 直接以字面量傳入即可,TS 會做結構檢查。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder-ui exec vitest run src/filter-schema.spec.ts`
Expected: FAIL —— `fieldsToFilterSchema` 不存在(import 錯誤)

- [ ] **Step 3: 實作**

`packages/table-builder-ui/src/filter-schema.ts` 改為:

```ts
import type { TableColumnConfig } from '@rfjs/table-builder';
import type { DataFieldMeta } from '@rfjs/data-schema';
import type { FieldSchema } from '@rfjs/filter-builder';

/** filterable 欄位 → filter-builder FieldSchema(ScalarType ≡ FieldType,dataType 直接帶)。 */
export function columnsToFilterSchema(columns: TableColumnConfig[]): FieldSchema[] {
  return columns
    .filter((c) => c.filterable)
    .map((c) => ({ path: c.key, dataType: c.dataType, include: true, kind: 'column' as const }));
}

/**
 * remote 篩選的 schema 來源(api-filter spec §2.1):meta fields 中 filterable 且已宣告 kind 的
 * 欄位 —— kind 是 authored 的查詢知識(column vs jsonb),缺省即視為不可遠端篩選。
 */
export function fieldsToFilterSchema(fields: DataFieldMeta[]): FieldSchema[] {
  return fields
    .filter((f) => f.filterable === true && f.kind !== undefined)
    .map((f) => ({ path: f.key, dataType: f.dataType, include: true, kind: f.kind as 'column' | 'jsonb' }));
}
```

`packages/table-builder-ui/src/types.ts` —— remote variant 改為(import 行補 `DataFieldMeta`):

```ts
import type { BuiltRequest, DataFieldMeta, RequestMeta, ResponseMeta } from '@rfjs/data-schema';
```

```ts
  | {
      kind: 'remote';
      request: RequestMeta;
      response: ResponseMeta;
      /** 遠端篩選的欄位描述(kind/dataType/filterable 的來源);缺省 = 此來源不可篩選。 */
      fields?: DataFieldMeta[];
      fetch: (built: BuiltRequest) => Promise<unknown>;
    };
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/table-builder-ui exec vitest run src/filter-schema.spec.ts`
Expected: PASS(既有 + 新 2 條)

- [ ] **Step 5: changeset**

`.changeset/table-builder-ui-remote-filter.md`:

```md
---
"@rfjs/table-builder-ui": minor
---

remote sources gain filtering: `TableSource.fields`, `fieldsToFilterSchema`, apply-triggered refetch carrying the compiled pg-filter group, and controlled filter-tree props on `ConfigTable`
```

- [ ] **Step 6: Commit**

```bash
git add packages/table-builder-ui/src/types.ts packages/table-builder-ui/src/filter-schema.ts packages/table-builder-ui/src/filter-schema.spec.ts .changeset/table-builder-ui-remote-filter.md
git commit -m "feat(table-builder-ui): add remote source fields and fieldsToFilterSchema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `useConfigTable` —— remote 篩選(Apply 語義)+ controlled tree option

**Files:**
- Modify: `packages/table-builder-ui/src/use-config-table.ts`
- Test: `packages/table-builder-ui/src/use-config-table.spec.ts`(附加)

**Interfaces:**
- Consumes: Task 1 `buildRequestParams(request, state, filter?)`;Task 2 `fieldsToFilterSchema`;filter-builder 既有 `treeToPgFilterGroup(tree, schema): PgFilterGroup`
- Produces(Task 4 用):`useConfigTable(config, source, options?: UseConfigTableOptions)`;`UseConfigTableOptions { filterTree?: BuilderGroup; onFilterTreeChange?: (next: BuilderGroup) => void }`;result 增 `applyFilter(): void` 與 `filterApplied: boolean`;`filterEnabled` 對 remote 也可為 true

- [ ] **Step 1: 寫失敗測試**

`packages/table-builder-ui/src/use-config-table.spec.ts` 檔尾附加(fixtures 風格對齊該檔既有 remote 測試 —— 先讀檔頂的既有 helper/config,重用其 `renderHook` 佈局與穩定 source 慣例):

```ts
describe('remote filtering (apply semantics)', () => {
  const FILTER_FIELDS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true, kind: 'column' as const },
  ];
  const FILTER_REQUEST = {
    endpoint: '/api/items',
    pagination: { strategy: 'page' as const, pageParam: 'page', pageSizeParam: 'pageSize' },
    filter: { style: 'pg' as const, param: 'filter' },
  };
  const RESPONSE = { rowsPath: 'data.items', totalPath: 'data.total' };

  function makeSource(fetchImpl: (built: unknown) => Promise<unknown>) {
    return {
      kind: 'remote' as const,
      request: FILTER_REQUEST,
      response: RESPONSE,
      fields: FILTER_FIELDS,
      fetch: fetchImpl as never,
    };
  }

  function treeWith(field: string, operator: string, value: unknown) {
    const group = emptyGroup(() => 'id-' + Math.random());
    return {
      ...group,
      children: [
        { kind: 'condition' as const, id: 'c1', field, dataType: 'numeric' as const, operator, value },
      ],
    };
  }

  it('enables filtering for a remote source that declares filter meta and filterable fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(CONFIG, source));
    expect(result.current.filterEnabled).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('keeps filtering disabled when the request declares no filter meta', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = { ...makeSource(fetchFn), request: { ...FILTER_REQUEST, filter: undefined } };
    const { result } = renderHook(() => useConfigTable(CONFIG, source));
    expect(result.current.filterEnabled).toBe(false);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('applyFilter compiles the tree, resets to page 1, and refetches with built.filter', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 30 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(CONFIG, source));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.page).toBe(1);
    expect(result.current.filterApplied).toBe(true);
    const lastBuilt = fetchFn.mock.calls.at(-1)![0] as { filter?: unknown; params: Record<string, string> };
    expect(lastBuilt.filter).toEqual({
      logic: 'and',
      filters: [{ target: 'column', column: 'price', operator: 'gte', value: 40 }],
    });
    expect(lastBuilt.params.page).toBe('1');
  });

  it('page navigation after apply keeps sending the applied filter', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }], total: 30 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(CONFIG, source));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const lastBuilt = fetchFn.mock.calls.at(-1)![0] as { filter?: unknown };
    expect(lastBuilt.filter).toBeDefined();
  });

  it('applying an empty tree clears the filter (built carries none)', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(CONFIG, source));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setFilterTree(emptyGroup(() => 'e1')));
    act(() => result.current.applyFilter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.filterApplied).toBe(false);
    const lastBuilt = fetchFn.mock.calls.at(-1)![0] as { filter?: unknown };
    expect(lastBuilt.filter).toBeUndefined();
  });

  it('editing the tree in remote mode does not refetch by itself', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    const source = makeSource(fetchFn);
    const { result } = renderHook(() => useConfigTable(CONFIG, source));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsBefore = fetchFn.mock.calls.length;

    act(() => result.current.setFilterTree(treeWith('price', 'gte', 40)));

    expect(fetchFn.mock.calls.length).toBe(callsBefore);
  });
});

describe('controlled filter tree', () => {
  it('uses the external tree and reports edits through onFilterTreeChange', () => {
    const external = emptyGroup(() => 'x1');
    const onChange = vi.fn();
    const source = { kind: 'rows' as const, rows: ROWS };
    const { result } = renderHook(() =>
      useConfigTable(CONFIG, source, { filterTree: external, onFilterTreeChange: onChange }),
    );

    expect(result.current.filterTree).toBe(external);
    const edited = { ...external, logic: 'or' as const };
    act(() => result.current.setFilterTree(edited));
    expect(onChange).toHaveBeenCalledWith(edited);
    // external 未更新前,hook 仍回報外部樹(受控)
    expect(result.current.filterTree).toBe(external);
  });
});
```

(`CONFIG`/`ROWS`/`renderHook`/`act`/`waitFor`/`vi`/`emptyGroup` 沿用該 spec 檔既有 import 與 fixtures;若名稱不同,對齊現檔為準 —— 不要另造平行 fixture。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder-ui exec vitest run src/use-config-table.spec.ts`
Expected: **7 條新測試中 5 條 FAIL**(enables filtering / applyFilter 兩條 / empty-tree / controlled tree —— `applyFilter` 不存在、remote `filterEnabled` 為 false、第三參數被忽略);**2 條守衛測試實作前即綠是預期**('keeps filtering disabled when the request declares no filter meta' 與 'editing the tree in remote mode does not refetch by itself' 驗證的是現行為的保持,不要動它們,實作後必須仍綠);既有測試仍 PASS

- [ ] **Step 3: 實作**

`packages/table-builder-ui/src/use-config-table.ts` 修改(全部 hook 保持無條件呼叫;檔頭順序註解同步更新為實際數量):

(a) import 補:

```ts
import { treeToPgFilterGroup } from '@rfjs/filter-builder';
import type { PgFilterGroup } from '@rfjs/pg-filter';
import { columnsToFilterSchema, fieldsToFilterSchema } from './filter-schema';
```

(`@rfjs/pg-filter` 已是 filter-builder 的依賴;`table-builder-ui/package.json` 的 `dependencies` 需補 `"@rfjs/pg-filter": "workspace:*"` 再 `pnpm install`。)

(b) options 介面與簽名:

```ts
export interface UseConfigTableOptions {
  /** 受控篩選樹:提供時 hook 不持有樹狀態,編輯經 onFilterTreeChange 回報。 */
  filterTree?: BuilderGroup;
  onFilterTreeChange?: (next: BuilderGroup) => void;
}

export function useConfigTable(
  config: TableConfig,
  source: TableSource,
  options: UseConfigTableOptions = {},
): UseConfigTableResult {
```

(c) result 介面增(`filterUncoverable` 之後):

```ts
  /** remote 模式:把當前樹編譯成 pg 群組並重抓(重置分頁);rows 模式 no-op。 */
  applyFilter(): void;
  /** remote 模式:目前是否有已套用(非空)的 filter。 */
  filterApplied: boolean;
```

(d) 樹狀態改為受控可切換(取代現有 `filterTree` state 宣告與 `setFilterTree`):

```ts
  const [internalTree, setInternalTree] = useState<BuilderGroup>(() => emptyGroup(() => crypto.randomUUID()));
  const externalTree = options.filterTree;
  const filterTree = externalTree ?? internalTree;
  const onFilterTreeChange = options.onFilterTreeChange;
```

```ts
  const setFilterTree = useCallback(
    (next: BuilderGroup) => {
      onFilterTreeChange?.(next);
      if (externalTree === undefined) setInternalTree(next);
      // rows 模式:編輯即生效,回第 1 頁;remote 模式:編輯不打 API(Apply 才生效),分頁不動
      if (sourceKind === 'rows') setPageState(1);
    },
    [onFilterTreeChange, externalTree, sourceKind],
  );
```

(`const sourceKind = source.kind;` 在 hook 頂部宣告一次,callback 依賴用它。)

(e) filter schema 與啟用條件(取代現有 `filterSchema` memo):

```ts
  const filterSchema = useMemo(
    () => (source.kind === 'remote' ? fieldsToFilterSchema(source.fields ?? []) : columnsToFilterSchema(config.columns)),
    [source, config.columns],
  );
  const remoteFilterEnabled =
    source.kind === 'remote' && source.request.filter !== undefined && filterSchema.length > 0;
```

(f) applied filter 狀態 + applyFilter。**位置有硬性要求**:`appliedFilter` 的 `useState` 必須放在 hook 頂部 state 區塊((d) 的 `internalTree` 宣告之後、**remote fetch effect 之前**)—— effect 的 deps 陣列會讀它,放在 effect 後面會 TDZ(`Cannot access 'appliedFilter' before initialization`,全部測試炸)。只有 `applyFilter` 這個 useCallback 放在 `setFilterTree` 定義之後:

```ts
  // 放 hook 頂部 state 區塊(internalTree 之後):
  const [appliedFilter, setAppliedFilter] = useState<PgFilterGroup | undefined>(undefined);
```

```ts
  // 放 setFilterTree 定義之後:
  const applyFilter = useCallback(() => {
    if (!remoteFilterEnabled) return;
    const group = treeToPgFilterGroup(filterTree, filterSchema);
    setAppliedFilter(hasConditions(group) ? group : undefined);
    setPageState(1);
    cursorsRef.current = [undefined]; // 篩選變了,舊游標無意義(spec §2.2)
  }, [remoteFilterEnabled, filterTree, filterSchema]);
```

模組層(檔尾 export 前)加 helper:

```ts
/** 空樹/全不完整條件會編譯成無葉群組 —— 這種 filter 不該上請求(spec §2.2「空樹」)。 */
function hasConditions(group: PgFilterGroup): boolean {
  return group.filters.some((f) => ('logic' in f ? hasConditions(f as PgFilterGroup) : true));
}
```

(g) fetch effect:`const built = buildRequestParams(request, pageState);` 改為

```ts
    const built = buildRequestParams(request, pageState, appliedFilter);
```

effect 依賴陣列補 `appliedFilter`(`[source, page, pageSize, sort, retryToken, appliedFilter]`)。

(h) 回傳物件:`filterEnabled` 與新欄位:

```ts
    filterEnabled: source.kind === 'rows' || remoteFilterEnabled,
    filterUncoverable: source.kind === 'rows' && match.uncoverable,
    applyFilter,
    filterApplied: appliedFilter !== undefined,
```

- [ ] **Step 4: 跑測試確認通過(含既有回歸)**

Run: `pnpm -F @rfjs/table-builder-ui exec vitest run src/use-config-table.spec.ts`
Expected: 全 PASS(既有 + 新 7 條)

Run: `pnpm -F @rfjs/table-builder-ui vitest:run && pnpm -F @rfjs/table-builder-ui lint && pnpm -F @rfjs/table-builder-ui check-types`
Expected: 全綠(留意 exhaustive-deps 與未用 import)

- [ ] **Step 5: Commit**

```bash
git add packages/table-builder-ui/src/use-config-table.ts packages/table-builder-ui/src/use-config-table.spec.ts packages/table-builder-ui/package.json pnpm-lock.yaml
git commit -m "feat(table-builder-ui): remote filter with apply semantics and controlled tree option

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `ConfigTable` —— Apply 鈕 + controlled props 佈線

**Files:**
- Modify: `packages/table-builder-ui/src/config-table.tsx`
- Modify: `packages/table-builder-ui/src/types.ts`(`TableLabels` 加選填 `filterApply`)
- Modify: `packages/table-builder-ui/src/labels.ts`(`DEFAULT_LABELS.filterApply`)
- Test: `packages/table-builder-ui/src/config-table.spec.tsx`(附加 + **同步一則既有文案斷言**,見 Step 3)

**Interfaces:**
- Consumes: Task 3 的 `UseConfigTableOptions`/`applyFilter`/`filterApplied`
- Produces(Task 5 用):`ConfigTableProps` 增 `filterTree?: BuilderGroup; onFilterTreeChange?: (next: BuilderGroup) => void;`;`TableLabels.filterApply?: string`(預設 `'Apply'`)

- [ ] **Step 1: 寫失敗測試**

`packages/table-builder-ui/src/config-table.spec.tsx` 檔尾附加(fixtures/render helper 沿用該檔既有慣例;remote source 必須是模組層穩定常數,避免 render 迴圈):

```tsx
describe('remote filter UI', () => {
  const REMOTE_FIELDS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true, kind: 'column' as const },
  ];
  const REMOTE_FETCH = () => Promise.resolve({ data: { items: [{ id: 'r1', price: 10 }], total: 1 } });
  const REMOTE_SOURCE = {
    kind: 'remote' as const,
    request: {
      endpoint: '/api/items',
      pagination: { strategy: 'page' as const, pageParam: 'page', pageSizeParam: 'pageSize' },
      filter: { style: 'pg' as const, param: 'filter' },
    },
    response: { rowsPath: 'data.items', totalPath: 'data.total' },
    fields: REMOTE_FIELDS,
    fetch: REMOTE_FETCH,
  };
  const REMOTE_SOURCE_NO_FILTER = {
    ...REMOTE_SOURCE,
    request: { ...REMOTE_SOURCE.request, filter: undefined },
  };

  it('shows an enabled filter toggle and an Apply button for a filterable remote source', async () => {
    render(<ConfigTable config={CONFIG} source={REMOTE_SOURCE} />);
    const toggle = screen.getByRole('button', { name: /filter/i });
    expect((toggle as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(toggle);
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeTruthy();
  });

  it('keeps the filter disabled for a remote source without filter meta', async () => {
    render(<ConfigTable config={CONFIG} source={REMOTE_SOURCE_NO_FILTER} />);
    const toggle = screen.getByRole('button', { name: /filter/i });
    expect((toggle as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.queryByText(/loading/i)).toBeNull());
  });

  it('rows mode shows no Apply button (live filtering unchanged)', () => {
    render(<ConfigTable config={CONFIG} source={{ kind: 'rows', rows: ROWS }} />);
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
  });
});

describe('controlled filter tree props', () => {
  it('renders the injected tree and reports edits via onFilterTreeChange', () => {
    const external = emptyGroup(() => 'ext-1');
    const onChange = vi.fn();
    render(
      <ConfigTable
        config={CONFIG}
        source={{ kind: 'rows', rows: ROWS }}
        filterTree={external}
        onFilterTreeChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    // FilterTreeEditor 的「+ condition」預設 label(DEFAULT_FILTER_TREE_LABELS)
    fireEvent.click(screen.getByRole('button', { name: /\+ condition/i }));
    expect(onChange).toHaveBeenCalled();
  });
});
```

(該檔**沒有** `CONFIG`/`ROWS` 這兩個名字 —— 既有 fixtures 是 `config`、`FILT_CFG`、`FILT_ROWS`(約 L27、L161-171),把片段中的 `CONFIG`/`ROWS` 對應替換;`render`/`screen`/`fireEvent`/`waitFor`/`vi` 沿用既有 import;**`emptyGroup` 是新 import**,檔頭補 `import { emptyGroup } from '@rfjs/filter-builder';`;`+ condition` 的實際預設字樣以 `filter-labels.ts` 的 `DEFAULT_FILTER_TREE_LABELS` 為準 —— 實作前先 `grep addCondition packages/table-builder-ui/src/filter-labels.ts` 確認。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/table-builder-ui exec vitest run src/config-table.spec.tsx`
Expected: **4 條中 2 條 FAIL** —— 'shows an enabled filter toggle and an Apply button'(Task 3 已使 toggle enabled,但 Apply 鈕不存在)與 controlled props 測試(props 未佈線,onFilterTreeChange 不會被呼叫);**2 條守衛實作前即綠是預期**('keeps the filter disabled…' 與 'rows mode shows no Apply button'),實作後必須仍綠;既有 PASS

- [ ] **Step 3: 實作**

`packages/table-builder-ui/src/types.ts` —— `TableLabels` 的 `filterDisabled` 之後加:

```ts
  /** remote 模式 Apply 鈕文字(選填;預設 'Apply')。 */
  filterApply?: string;
```

`packages/table-builder-ui/src/labels.ts` —— `filterDisabled` 行後加:

```ts
  filterApply: 'Apply',
```

同時把 `filterDisabled` 的預設文案更新(舊文案說 api filter coming later,已過時):

```ts
  filterDisabled: 'This data source does not declare a remote filter.',
```

**同步既有測試**:`config-table.spec.tsx` 的 'disables the filter for a remote source with a note'(約 L202)斷言跟隨文案改 —— `expect(screen.getByText(/api filter coming later/i)).toBeTruthy();` 改為 `expect(screen.getByText(/does not declare a remote filter/i)).toBeTruthy();`。這是等強度的文案同步(測試仍驗證「remote 無 filter meta 時顯示停用說明」),不屬於刪弱既有測試。

`packages/table-builder-ui/src/config-table.tsx`:

(a) `ConfigTableProps` 的 `filterLabels` 之後加(import 補 `type { BuilderGroup } from '@rfjs/filter-builder'`):

```ts
  /** 受控篩選樹(NL 助手等外部寫入用);未傳 = 內部狀態。 */
  filterTree?: BuilderGroup;
  onFilterTreeChange?: (next: BuilderGroup) => void;
```

(b) 元件簽名與 hook 呼叫:

```ts
export function ConfigTable({ config, source, labels, locale = 'en', filterLabels, filterTree, onFilterTreeChange }: ConfigTableProps) {
  const t = useConfigTable(config, source, { filterTree, onFilterTreeChange });
```

(c) 篩選面板內、`<FilterTreeEditor …/>` 之後加:

```tsx
            {t.strategy !== 'client' && (
              <div className="mt-2 flex justify-end">
                <Button size="xs" variant="outline" onClick={t.applyFilter}>
                  {mergedLabels.filterApply ?? 'Apply'}
                </Button>
              </div>
            )}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/table-builder-ui vitest:run && pnpm -F @rfjs/table-builder-ui lint && pnpm -F @rfjs/table-builder-ui check-types`
Expected: 全綠

- [ ] **Step 5: Commit**

```bash
git add packages/table-builder-ui/src/config-table.tsx packages/table-builder-ui/src/config-table.spec.tsx packages/table-builder-ui/src/types.ts packages/table-builder-ui/src/labels.ts
git commit -m "feat(table-builder-ui): apply button for remote filters and controlled tree props

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: web 工具示範 —— 假 fetcher 執行 pg filter + 樣本/文案接線

**Files:**
- Modify: `apps/web/src/tools/table-builder/sample.ts`(fields 加 kind/filterable;request 加 filter)
- Modify: `apps/web/src/tools/table-builder/fake-fetcher.ts`(pg 群組 → 記憶體過濾)
- Modify: `apps/web/src/tools/table-builder/ui.tsx`(source 補 `fields`;labels 補 `filterApply`)
- Modify: `apps/web/src/tools/table-builder/messages.ts`(en/zh-TW 各加 `tbFilterApply`)
- Test: `apps/web/src/tools/table-builder/fake-fetcher.spec.ts`、`apps/web/src/tools/table-builder/ui.spec.tsx`(附加)

**Interfaces:**
- Consumes: Tasks 1–4 全部;filter-builder 既有 `filterGroupToTree(group, makeId)`/`runLiveMatch(rows, tree)`
- Produces: `makeFakeFetcher(rows, columns, fields?)`(第三參數選填、向後相容)

- [ ] **Step 1: 寫失敗測試**

`apps/web/src/tools/table-builder/fake-fetcher.spec.ts` 檔尾附加:

```ts
describe('pg filter execution', () => {
  const FIELDS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const, filterable: true, kind: 'column' as const },
    { key: 'author.name', label: 'Author', dataType: 'string' as const, filterable: true, kind: 'jsonb' as const },
  ];
  const ROWS = [
    { id: 1, price: 10, author: { name: 'Ada' } },
    { id: 2, price: 50, author: { name: 'Grace' } },
    { id: 3, price: 90, author: { name: 'Ada' } },
  ];
  const COLUMNS = [
    { key: 'price', label: 'Price', dataType: 'numeric' as const },
    { key: 'author.name', label: 'Author', dataType: 'string' as const },
  ];

  function built(filter: unknown) {
    return { endpoint: '/x', method: 'GET' as const, params: { limit: '10', offset: '0' }, filter };
  }

  it('filters by a column leaf (dataType resolved from fields)', async () => {
    const fetcher = makeFakeFetcher(ROWS, COLUMNS, FIELDS);
    const payload = (await fetcher(
      built({ logic: 'and', filters: [{ target: 'column', column: 'price', operator: 'gte', value: 50 }] }),
    )) as { data: { items: unknown[]; total: number } };
    expect(payload.data.total).toBe(2);
    expect(payload.data.items).toHaveLength(2);
  });

  it('filters by a jsonb leaf with a nested path', async () => {
    const fetcher = makeFakeFetcher(ROWS, COLUMNS, FIELDS);
    const payload = (await fetcher(
      built({
        logic: 'and',
        filters: [{ target: 'jsonb', field: 'author.name', dataType: 'string', operator: 'eq', value: 'Ada' }],
      }),
    )) as { data: { items: unknown[]; total: number } };
    expect(payload.data.total).toBe(2);
  });

  it('serves all rows when built carries no filter (back-compat)', async () => {
    const fetcher = makeFakeFetcher(ROWS, COLUMNS, FIELDS);
    const payload = (await fetcher(built(undefined))) as { data: { total: number } };
    expect(payload.data.total).toBe(3);
  });
});
```

`apps/web/src/tools/table-builder/ui.spec.tsx` 檔尾附加:

```tsx
  it('fetcher mode: filter section is enabled and offers an Apply button', async () => {
    renderTool();
    fireEvent.click(screen.getByRole('button', { name: 'Fake fetcher' }));

    const toggle = await screen.findByRole('button', { name: /filter/i });
    await waitFor(() => expect((toggle as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(toggle);
    expect(await screen.findByRole('button', { name: 'Apply' })).toBeTruthy();
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web exec vitest run src/tools/table-builder/fake-fetcher.spec.ts src/tools/table-builder/ui.spec.tsx`
Expected: fake-fetcher **前 2 條 FAIL**(filter 未實作 → total 不縮);**第 3 條 back-compat 實作前即綠是預期**(現行為本就回全量,它是回歸守衛);ui 1 條 FAIL(remote filter 未啟用/無 Apply)

- [ ] **Step 3: 實作**

`apps/web/src/tools/table-builder/sample.ts`:

(a) fields 改為(混合 column/jsonb,示範「平面欄=column、巢狀路徑=jsonb」):

```ts
  fields: [
    { key: "id", label: "ID", dataType: "string", sortable: true },
    { key: "title", label: "Title", dataType: "string", sortable: true, filterable: true, kind: "column" },
    { key: "price", label: "Price", dataType: "numeric", format: "currency", sortable: true, filterable: true, kind: "column" },
    { key: "createdAt", label: "Created", dataType: "date", format: "date", sortable: true },
    { key: "inStock", label: "In stock", dataType: "boolean" },
    { key: "author.name", label: "Author", dataType: "string", sortable: true, filterable: true, kind: "jsonb" },
    {
      key: "status",
      label: "Status",
      dataType: "string",
      filterable: true,
      kind: "column",
      options: [
        { value: "draft", label: "Draft" },
        { value: "published", label: "Published" },
        { value: "archived", label: "Archived" },
      ],
    },
  ],
```

(b) `request` 加 filter 宣告(`sort` 行後):

```ts
    filter: { style: "pg", param: "filter" },
```

**注意連動**:fields 加了 `filterable` 後,`deriveTableConfig` 會把它帶進 `SAMPLE_CONFIG.columns` → rows 模式的篩選欄位集合變大(原本工具裡 rows 篩選是使用者在 Columns 面板手勾)。這是**預期行為**(同一份 meta 兩種模式都吃);既有 ui.spec 若有對 rows 篩選欄位數的硬斷言需同步檢視(#238 的 e2e 是先手勾 `Filter price`,勾選已勾欄位仍為勾,不受影響)。

`apps/web/src/tools/table-builder/fake-fetcher.ts`:

(a) import 補:

```ts
import { filterGroupToTree, runLiveMatch } from "@rfjs/filter-builder";
import type { FilterConditionLike, FilterGroupLike } from "@rfjs/filter-builder";
import type { PgFilterGroup, PgLeaf } from "@rfjs/pg-filter";
import type { BuiltRequest, DataFieldMeta } from "@rfjs/data-schema";
```

(b) `paginate` 之後加 adapter 與過濾:

```ts
// pg 群組 → filter-builder 的 FilterGroupLike:column 葉不帶 dataType,從 fields 反查(spec §3)。
function pgLeafToCondition(leaf: PgLeaf, fields: DataFieldMeta[]): FilterConditionLike {
  if (leaf.target === "column") {
    const meta = fields.find((f) => f.key === leaf.column);
    return { field: leaf.column, dataType: meta?.dataType ?? "string", operator: leaf.operator, value: leaf.value };
  }
  return {
    field: leaf.field,
    dataType: leaf.dataType as FilterConditionLike["dataType"],
    operator: leaf.operator,
    value: leaf.value,
  };
}

function pgGroupToFilterGroup(group: PgFilterGroup, fields: DataFieldMeta[]): FilterGroupLike {
  return {
    logic: group.logic,
    filters: group.filters.map((node) =>
      "logic" in node ? pgGroupToFilterGroup(node as PgFilterGroup, fields) : pgLeafToCondition(node as PgLeaf, fields),
    ),
  };
}

/** built.filter(PgFilterGroup)→ reverse 成 builder 樹 → runLiveMatch 在記憶體執行(dogfood reverse 鏈)。 */
function applyPgFilter(
  rows: Record<string, unknown>[],
  filter: unknown,
  fields: DataFieldMeta[],
): Record<string, unknown>[] {
  if (filter === undefined) return rows;
  const tree = filterGroupToTree(pgGroupToFilterGroup(filter as PgFilterGroup, fields), () => crypto.randomUUID());
  const match = runLiveMatch(rows, tree);
  // 不可覆蓋的運算子:示範資料不該發生;寧可回全量也不要誤報 0 筆
  return match.uncoverable ? rows : (match.matched as Record<string, unknown>[]);
}
```

(c) `makeFakeFetcher` 簽名與 body:

```ts
export function makeFakeFetcher(
  rows: Record<string, unknown>[],
  columns: TableColumnConfig[],
  fields: DataFieldMeta[] = [],
): (built: BuiltRequest) => Promise<unknown> {
  return (built: BuiltRequest): Promise<unknown> => {
    const filtered = applyPgFilter(rows, built.filter, fields);
    const sort = parseSort(built.params);
    const sorted = sort ? sortRows(filtered, sort, columns) : filtered;
    const { items, total, nextCursor } = paginate(sorted, built.params);
    // …以下不變
```

(檔頭既有的 `import type { BuiltRequest } from "@rfjs/data-schema";` 併入 (a) 的 import。)

`apps/web/src/tools/table-builder/ui.tsx`:

(a) `source` memo 的 remote 分支加 `fields` 並把 fetcher 換三參數:

```ts
    return {
      kind: "remote",
      request,
      response: SAMPLE_META.response!,
      fields: SAMPLE_META.fields,
      fetch: makeFakeFetcher(SAMPLE_ROWS, config.columns, SAMPLE_META.fields),
    };
```

(b) `labels` memo 的 `filterDisabled` 行後加:

```ts
      filterApply: t("tbFilterApply"),
```

`apps/web/src/tools/table-builder/messages.ts` —— `tbFilterDisabled` 行後,en:

```ts
      tbFilterApply: "Apply",
```

zh-TW:

```ts
      tbFilterApply: "套用",
```

同步把兩語系的 `tbFilterDisabled` 文案更新(舊文案「此資料來源不支援篩選/static data only」已過時):en `"This data source does not declare a remote filter."`、zh-TW `"此資料來源未宣告遠端篩選。"`

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web exec vitest run src/tools/table-builder/`
Expected: 全 PASS(fake-fetcher +3、ui +1、其餘既有不變)

Run: `pnpm -F web lint && pnpm -F web check-types`
Expected: 皆綠

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/table-builder/sample.ts apps/web/src/tools/table-builder/fake-fetcher.ts apps/web/src/tools/table-builder/fake-fetcher.spec.ts apps/web/src/tools/table-builder/ui.tsx apps/web/src/tools/table-builder/ui.spec.tsx apps/web/src/tools/table-builder/messages.ts
git commit -m "feat(web): fake fetcher executes pg filters to demo the remote filter chain

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: e2e + 全量驗證 + 截圖 + HOLD PR

**Files:**
- Modify: `apps/web/e2e/table-builder.e2e.ts`(新增 1 條)
- 無其他新程式;產出截圖(session scratchpad)與 PR

**Interfaces:**
- Consumes: Tasks 1–5 全部
- Produces: 綠的全量檢查、e2e、light/dark 截圖、HOLD PR

- [ ] **Step 1: 新增 e2e**

`apps/web/e2e/table-builder.e2e.ts` 檔尾附加(selector 慣例對齊既有第 2 條:operator 無 override 顯示原始 id;Filter toggle 名稱含後綴用 substring):

```ts
test("fetcher mode: applying a remote filter shrinks the result set", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });

  // 切到假 fetcher(Source 頁籤是預設頁籤)
  await page.getByRole("button", { name: "Fake fetcher" }).click();
  await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Filter" }).click();
  await page.getByRole("button", { name: "+ condition" }).click();
  await page.getByRole("combobox", { name: "field" }).click();
  await page.getByRole("option", { name: "price" }).click();
  await page.getByRole("combobox", { name: "operator" }).click();
  await page.getByRole("option", { name: "gte", exact: true }).click();
  await page.getByRole("textbox", { name: "value" }).fill("40");
  await page.getByRole("button", { name: "Apply", exact: true }).click();

  // SAMPLE_ROWS 的 price = 10 + n*3.5(n=1..18)→ gte 40 命中 n>=9,共 10 筆
  await expect(page.getByText("10 rows")).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 2: 全量檢查 + build + e2e**

Run: `pnpm -F @rfjs/data-schema build && pnpm build:packages && pnpm test`
Expected: 全綠(turbo 49 tasks 級;`@rfjs/db`/`form-builder` 的既有 lint/typecheck 噪音不在 test 範圍)

Run: `pnpm -F web build`
Expected: 成功

Run: `E2E_PORT=3013 pnpm -F web test:e2e e2e/table-builder.e2e.ts`
Expected: 4 條全 PASS(既有 3 + 新 1)

- [ ] **Step 3: 真渲染截圖(light + dark)**

以 production build 起服(port 3013),Playwright 腳本拍:

1. fetcher 模式 + 篩選展開(含 Apply 鈕)
2. Apply 後結果(列數縮、footer total 變)

light + dark 各一輪(`localStorage.setItem("theme", "dark")` 後 reload)。逐張人工檢視;截圖存 session scratchpad,回報附絕對路徑。

- [ ] **Step 4: push + HOLD PR**

```bash
git push -u origin feat-api-filter
gh pr create --title "feat: remote filter contract and apply-driven configtable filtering" --body "$(cat <<'EOF'
## Summary
- `@rfjs/data-schema` (minor): remote-filter contract — `DataFieldMeta.kind` ('column'|'jsonb', authored only), `RequestMeta.filter` (`{ style: 'pg', param }`), opaque `BuiltRequest.filter` via `buildRequestParams(request, state, filter?)`
- `@rfjs/table-builder-ui` (minor): remote sources gain filtering — `TableSource.fields` + `fieldsToFilterSchema`, apply-triggered refetch (page/cursor reset, filter persists across pagination/sort), controlled filter-tree props on `ConfigTable` (groundwork for the NL assist round)
- apps/web table-builder tool: the fake fetcher now executes `built.filter` in memory (pg group → `filterGroupToTree` → `runLiveMatch`, dogfooding the reverse chain); sample meta declares mixed column/jsonb filterable fields

No postgres needed anywhere — the whole chain is exercised by unit tests, one new e2e, and the fake-fetcher demo. Zero changes to `filter-builder`, the `table-builder` engine, workbench, and form-builder.

**HOLD: do not merge** — pending user review.

Spec: docs/superpowers/specs/2026-07-10-api-filter-stack-design.md
Plan: docs/superpowers/plans/2026-07-10-api-filter-stack.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR 建立,回報 PR 連結 + 截圖絕對路徑,等使用者 review/merge。
