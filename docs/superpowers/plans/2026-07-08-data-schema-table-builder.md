# data-schema + table-builder — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 三個新套件(`@rfjs/data-schema` 資料描述契約、`@rfjs/table-builder` TableConfig 引擎、`@rfjs/table-builder-ui` React 渲染)+ apps/web 展示工具「table-builder」。

**Architecture:** 依賴單向:data-schema ← table-builder ← table-builder-ui ← 工具。engine 純函式 / UI hook+元件分工比照 filter-builder 家族。規格:`docs/superpowers/specs/2026-07-08-data-schema-table-builder-design.md`(**每個任務開工前先讀 spec 對應章節 —— 任務內文引用「spec §N」處以 spec 為準**)。

**Tech Stack:** zod v4、tsdown(publishable 套件)、React 19 + transpilePackages(UI 套件)、vitest(+jsdom for UI)、Playwright e2e。

## Global Constraints

- 工作目錄:worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-data-table`,分支 `feat-data-table`(已基於含 #234/#235 的 main)。
- **接縫凍結**:`TableConfig` 型別名與 `@rfjs/table-builder` 套件名不得更改(form-builder result item 的 `{ mode: 'table', table }` 以此為準)。
- **紀律**:不引入 JSON Schema/OpenAPI;衍生是單向 compile;不碰 `packages/form-builder*/**`、`apps/web/src/tools/form-builder/**`(共用註冊檔可 append —— 目前無並行 session,但仍只做 append 式變更)。
- 打包:publishable 套件(data-schema、table-builder)完全比照 `packages/decision-table` 的檔案組(package.json 欄位、tsdown.config.ts、tsconfig{,.build}.json、vitest.config.mts、eslint.config.js 原樣複製後改名);UI 套件比照 `packages/filter-builder-ui`(private、`"type": "module"`、exports 指 `./src/index.ts`、無 build)。
- Changesets:三個套件各一份 **minor**(UI private 也要,version-only);apps 不寫;手寫 markdown。
- Commit:英文 conventional(subject 全小寫),結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 測試指令:`pnpm -F @rfjs/data-schema vitest:run`、`pnpm -F @rfjs/table-builder vitest:run`、`pnpm -F @rfjs/table-builder-ui vitest:run`、`pnpm -F web vitest:run <path>`。新套件建好後先 `pnpm install`(讓 workspace 連結)再 `pnpm build:packages`。
- 已知 baseline:`@rfjs/form-builder` typecheck 有 3 個 main 既有錯誤 —— 與本案無關,不要動。
- 新增 scaffold 檔(package.json/tsconfig/config)不走 TDD;各任務的邏輯模組一律 TDD。

---

### Task 1: `@rfjs/data-schema` 腳手架 + 核心型別/zod + 基礎工具

**Files:**
- Create: `packages/data-schema/{package.json,tsconfig.json,tsconfig.build.json,tsdown.config.ts,vitest.config.mts,eslint.config.js}`(自 `packages/decision-table/` 同名檔複製;package.json 改:name `@rfjs/data-schema`、description `Data resource metadata contract: field metadata, request pagination/sort protocol, response envelope paths, with infer/build/extract helpers`、keywords `["data", "schema", "metadata", "pagination", "table"]`、repository.directory `packages/data-schema`、homepage 對應、dependencies 僅 `"zod": "^4.0.0"`)
- Create: `packages/data-schema/src/{types.ts,localized-label.ts,path.ts,schema.ts,index.ts}` + `{localized-label,path,schema}.spec.ts`
- Create: `.changeset/data-schema-init.md`

**Interfaces:**
- Produces(後續全部依賴):spec §3.1 的全部型別(`ScalarType`/`LocalizedLabel`/`FieldFormat`/`FieldOption`/`DataFieldMeta`/`PaginationMeta`/`SortMeta`/`RequestMeta`/`ResponseMeta`/`DataResourceMeta`)+ `SortState { key: string; direction: 'asc' | 'desc' }`、`PageState { pageSize: number; offset?: number; page?: number; cursor?: string; sort?: SortState }`、`BuiltRequest { endpoint: string; method: 'GET' | 'POST'; params: Record<string, string> }`
- `resolveLabel(label, locale, fallbackLocale?)`(實作**複製** `packages/form-builder/src/localized-label.ts`,不 import form-builder)
- `getByPath(obj: unknown, path: string): unknown`(dot path;`''` 回傳 obj 本身)
- `dataResourceMetaSchema` / `parseDataResourceMeta(input): DataResourceMeta`(zod;format×dataType superRefine、pagination/sort discriminated union)

- [ ] **Step 1: 建腳手架**(複製 + 改欄位,如上)並寫失敗測試:

`localized-label.spec.ts`:string 直接回傳;record 依 locale;locale 缺→fallbackLocale;都缺→第一個值;空 record→''。
`path.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getByPath } from './path';

describe('getByPath', () => {
  it('resolves nested dot paths', () => {
    expect(getByPath({ a: { b: [1, 2] } }, 'a.b')).toEqual([1, 2]);
  });
  it('returns the object itself for empty path', () => {
    const o = { a: 1 };
    expect(getByPath(o, '')).toBe(o);
  });
  it('returns undefined for missing segments and non-objects', () => {
    expect(getByPath({ a: 1 }, 'a.b.c')).toBeUndefined();
    expect(getByPath(null, 'a')).toBeUndefined();
  });
});
```

`schema.spec.ts`(核心案例,spec §3.1 為準):

```ts
import { describe, expect, it } from 'vitest';
import { parseDataResourceMeta } from './schema';

const field = (over: object = {}) => ({ key: 'name', label: 'Name', dataType: 'string', ...over });

describe('parseDataResourceMeta', () => {
  it('accepts a minimal fields-only meta', () => {
    expect(() => parseDataResourceMeta({ fields: [field()] })).not.toThrow();
  });

  it('accepts a full remote meta (all three pagination strategies)', () => {
    const paginations = [
      { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
      { strategy: 'page', pageParam: 'page', pageSizeParam: 'size', firstPage: 0 },
      { strategy: 'cursor', cursorParam: 'cursor', limitParam: 'limit' },
    ];
    for (const pagination of paginations) {
      expect(() => parseDataResourceMeta({
        fields: [field({ dataType: 'numeric', format: 'currency', sortable: true })],
        request: { endpoint: '/api/items', pagination, sort: { style: 'single', param: 'sort', encoding: 'colon' } },
        response: { rowsPath: 'data.items', totalPath: 'data.total' },
      })).not.toThrow();
    }
  });

  it('rejects format incompatible with dataType', () => {
    expect(() => parseDataResourceMeta({ fields: [field({ dataType: 'string', format: 'currency' })] })).toThrow();
    expect(() => parseDataResourceMeta({ fields: [field({ dataType: 'numeric', format: 'datetime' })] })).toThrow();
    expect(() => parseDataResourceMeta({ fields: [field({ dataType: 'boolean', format: 'integer' })] })).toThrow();
  });

  it('rejects unknown pagination strategy and empty field key', () => {
    expect(() => parseDataResourceMeta({ fields: [field({ key: '' })] })).toThrow();
    expect(() => parseDataResourceMeta({
      fields: [field()],
      request: { endpoint: '/x', pagination: { strategy: 'scroll' } },
    })).toThrow();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**(模組不存在)。Run: `pnpm install && pnpm -F @rfjs/data-schema vitest:run`
- [ ] **Step 3: 實作** — `types.ts` 照 spec §3.1 + Interfaces 區塊;`localized-label.ts` 複製 form-builder 版;`path.ts`:

```ts
export function getByPath(obj: unknown, path: string): unknown {
  if (path === '') return obj;
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}
```

`schema.ts`:zod schema 群(`localizedLabelSchema = z.union([z.string(), z.record(z.string(), z.string())])`;`dataFieldMetaSchema` 以 superRefine 驗 format×dataType:numeric→integer/decimal/percent/currency、date→date/datetime/time、string/boolean 不得有 format;`paginationMetaSchema` discriminatedUnion('strategy');`sortMetaSchema` discriminatedUnion('style');`requestMetaSchema`/`responseMetaSchema`/`dataResourceMetaSchema`;`parseDataResourceMeta = (i) => dataResourceMetaSchema.parse(i)`,型別以 `satisfies`/`ZodType` 對齊 types.ts)。`index.ts` `export *` 全部模組。

`.changeset/data-schema-init.md`:

```md
---
"@rfjs/data-schema": minor
---

New package: data resource metadata contract — field metadata (key/label/dataType/format/options/sortable), request protocol (offset/page/cursor pagination + sort encodings), response envelope paths, with zod validation and infer/build/extract helpers.
```

- [ ] **Step 4: 全綠 + build**。Run: `pnpm -F @rfjs/data-schema vitest:run && pnpm -F @rfjs/data-schema typecheck && pnpm build:packages`
- [ ] **Step 5: Commit**(`feat(data-schema): scaffold package with resource metadata contract and zod schemas`)

---

### Task 2: data-schema helpers(infer / buildRequestParams / extract*)

**Files:**
- Create: `packages/data-schema/src/{infer.ts,request.ts,response.ts}` + 對應 `.spec.ts`(index.ts 補 export)

**Interfaces:**
- Produces:
  - `inferFieldsFromRows(rows: unknown): DataFieldMeta[]`(spec §3.2:巢狀攤平 dot path、number→numeric、boolean→boolean、ISO 日期字串→date、其餘 string、跨列衝突退 string、null/undefined 跳過、物件/陣列本身不產生欄位、label=key、非陣列或列非純物件丟 Error、空陣列回 `[]`)
  - `buildRequestParams(request: RequestMeta, state: PageState): BuiltRequest`(spec §3.2;三策略 × 兩種 sort 帶法;cursor 無值不帶參數;page 預設 firstPage 1)
  - `extractRows(payload: unknown, response: ResponseMeta): unknown[]`(rowsPath 取不到或非陣列 → 丟含 path 的 Error)
  - `extractTotal(payload, response): number | undefined`、`extractCursor(payload, response): string | undefined`(path 未設或取不到/型別不符 → undefined)

- [ ] **Step 1: 寫失敗測試** — `infer.spec.ts` 核心案例:

```ts
it('infers scalar types and flattens nested objects to dot paths', () => {
  const fields = inferFieldsFromRows([
    { name: 'a', age: 30, active: true, joined: '2024-01-15T00:00:00Z', author: { name: 'x' }, tags: ['a'] },
  ]);
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f.dataType]));
  expect(byKey).toEqual({ name: 'string', age: 'numeric', active: 'boolean', joined: 'date', 'author.name': 'string' });
  // tags(陣列)與 author(物件本身)不產生欄位
});
it('falls back to string on cross-row type conflicts and skips null', () => {
  const fields = inferFieldsFromRows([{ v: 1 }, { v: 'x' }, { w: null }, { w: 2 }]);
  expect(Object.fromEntries(fields.map((f) => [f.key, f.dataType]))).toEqual({ v: 'string', w: 'numeric' });
});
it('returns [] for empty array and throws on non-array / non-object rows', () => {
  expect(inferFieldsFromRows([])).toEqual([]);
  expect(() => inferFieldsFromRows('x')).toThrow();
  expect(() => inferFieldsFromRows([1])).toThrow();
});
```

`request.spec.ts` 核心案例(全部斷言 `params` 精確相等):offset `{limit:'10',offset:'20'}`;page firstPage 預設 1 → `{page:'3',size:'10'}`、firstPage 0 → page 3 帶 `'2'`?(**否** —— `state.page` 是 API 原生頁碼,直接帶;firstPage 只在缺省時決定起始值:`String(state.page ?? request.pagination.firstPage ?? 1)`);cursor 無 cursor → 只帶 limit、有 cursor → 兩者;sort colon → `sort=name:asc`、signed desc → `sort=-name`、split → `sortBy=name&order=asc`;method 預設 GET。
`response.spec.ts`:rowsPath `'data.items'` 取中;`''` 且 payload 為陣列;rowsPath 取到非陣列 → throw 訊息含 path;totalPath 取到字串 → undefined;cursorPath 取到 → 字串。

- [ ] **Step 2: 確認失敗** → **Step 3: 實作**(依 Interfaces;infer 的 ISO 偵測用 `/^\d{4}-\d{2}-\d{2}(T.*)?$/` + `!Number.isNaN(Date.parse(v))`;純物件判定 `Object.getPrototypeOf(o) === Object.prototype || null`)→ **Step 4: 全綠**(`pnpm -F @rfjs/data-schema vitest:run && pnpm build:packages`)→ **Step 5: Commit**(`feat(data-schema): add field inference, request building and response extraction helpers`)

---

### Task 3: `@rfjs/table-builder` 腳手架 + TableConfig/zod + deriveTableConfig

**Files:**
- Create: `packages/table-builder/`(腳手架同 Task 1 方式複製 decision-table;package.json:name `@rfjs/table-builder`、description `Config-driven read-only data table engine over @rfjs/data-schema: TableConfig, derive from resource metadata, sorting/formatting/pagination pure functions`、keywords `["table", "datagrid", "config-driven", "pagination"]`、dependencies `{"@rfjs/data-schema": "workspace:*", "zod": "^4.0.0"}`)
- Create: `packages/table-builder/src/{types.ts,schema.ts,derive.ts,index.ts}` + `{schema,derive}.spec.ts`
- Create: `.changeset/table-builder-init.md`(minor;描述比照 Task 1 風格)

**Interfaces:**
- Produces(**名稱凍結**):spec §4.1 的 `TableColumnConfig`/`TableConfig`;`tableConfigSchema`/`parseTableConfig`;`deriveTableConfig(meta: DataResourceMeta): TableConfig`(spec §4.2:fields 逐一映射、filterable 忽略、pageSize 預設 10)。
- `index.ts` 另 re-export data-schema 的 `resolveLabel`、`getByPath` 與常用型別(spec §4.2)。

- [ ] **Step 1: 寫失敗測試** — `schema.spec.ts`:合法(最小 columns+pagination;完整含 pin/align/visible/defaultSort);非法(columns 空陣列、pageSize 0、pin 非 left/right、direction 非 asc/desc)。`derive.spec.ts`:

```ts
it('maps fields to columns and defaults pageSize to 10', () => {
  const cfg = deriveTableConfig({
    fields: [
      { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true, filterable: true },
      { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
    ],
  });
  expect(cfg.pagination).toEqual({ pageSize: 10 });
  expect(cfg.columns).toEqual([
    { key: 'name', label: { en: 'Name' }, dataType: 'string', sortable: true },
    { key: 'price', label: 'Price', dataType: 'numeric', format: 'currency', options: [{ value: 1, label: 'One' }] },
  ]); // filterable 不帶過去;visible/pin/align 缺省不寫
});
```

- [ ] **Step 2: 確認失敗** → **Step 3: 實作**(types/zod 照 spec §4.1;derive 條件展開,缺省欄位不寫 key)→ **Step 4: 全綠 + `pnpm build:packages`** → **Step 5: Commit**(`feat(table-builder): scaffold package with tableconfig schema and metadata derivation`)

---

### Task 4: table-builder 純函式(sortRows / formatCell / 分頁計算)

**Files:**
- Create: `packages/table-builder/src/{sort.ts,format.ts,paginate.ts}` + 對應 `.spec.ts`(index.ts 補 export)

**Interfaces:**
- Produces(spec §4.2 為準):
  - `sortRows(rows: Record<string, unknown>[], sort: SortState, columns: TableColumnConfig[]): Record<string, unknown>[]` — 依 column dataType 選比較器(numeric 數值、date `Date.parse`、string `localeCompare`、boolean false<true);值用 `getByPath(row, sort.key)`;null/undefined **不論方向一律沉底**;stable;不改動輸入。
  - `formatCell(value: unknown, column: TableColumnConfig, locale = 'en'): string` — null/undefined→`''`;有 `options` 先查 value→label(`resolveLabel`,查不到 `String(value)`);numeric format:integer→`Intl.NumberFormat(locale,{maximumFractionDigits:0})`、decimal→`{minimumFractionDigits:2,maximumFractionDigits:2}`、percent→`{style:'percent'}`、currency→`{style:'currency',currency:'USD'}`(參數化列 future work);date format:輸入 `Date|string|number` 經 `new Date()`,invalid→`String(value)`;date→`{dateStyle:'medium'}`、datetime→`{dateStyle:'medium',timeStyle:'short'}`、time→`{timeStyle:'short'}`;無 format→`String(value)`。
  - `pageCount(total: number, pageSize: number): number`(`Math.max(1, Math.ceil(total / pageSize))`)、`pageToOffset(page, pageSize, firstPage = 1)`、`offsetToPage(offset, pageSize, firstPage = 1)`、`hasNextCursor(cursor: string | undefined): boolean`。

- [ ] **Step 1: 寫失敗測試**(核心案例):sortRows — numeric asc/desc、date、boolean、string localeCompare、null 沉底(asc 與 desc 都在尾)、巢狀 key `author.name`、stable(同值保持原順序)、輸入不變;formatCell — options 命中/未命中、integer 千分位(`(12345.6, integer)` → `'12,346'` en)、decimal `'12,345.60'`、percent(`0.15`→`'15%'`)、currency 含 `'$'`、date 各 token(斷言含年份與月份縮寫即可,避免 ICU 環境差)、invalid date 回原字串、null→`''`;paginate — pageCount(0→1、101/10→11)、page↔offset 互轉(firstPage 0/1)、hasNextCursor。
- [ ] **Step 2: 確認失敗** → **Step 3: 實作** → **Step 4: 全綠 + build** → **Step 5: Commit**(`feat(table-builder): add sorting, cell formatting and pagination pure functions`)

---

### Task 5: `@rfjs/table-builder-ui` 腳手架 + `useConfigTable`(靜態來源)

**Files:**
- Create: `packages/table-builder-ui/package.json`(複製 `packages/filter-builder-ui/package.json`,改:name `@rfjs/table-builder-ui`、description `Shared styled config-driven data table (React) over @rfjs/table-builder; optional labels with English defaults, consumed via transpilePackages`、dependencies `{"@rfjs/table-builder": "workspace:*", "@rfjs/web-ui": "workspace:*", "lucide-react": "^1.17.0"}`,其餘 devDeps/peerDeps 原樣)+ 同套件的 `tsconfig.json`/`eslint.config.js`/`vitest.config.mts`(自 filter-builder-ui 複製)
- Create: `packages/table-builder-ui/src/{types.ts,labels.ts,use-config-table.ts,index.ts}` + `use-config-table.spec.ts`
- Create: `.changeset/table-builder-ui-init.md`(minor)

**Interfaces:**
- Produces:
  - `type TableSource = { kind: 'rows'; rows: Record<string, unknown>[] } | { kind: 'remote'; request: RequestMeta; response: ResponseMeta; fetch: (built: BuiltRequest) => Promise<unknown> }`
  - `interface TableLabels { empty: string; loading: string; error: string; retry: string; prev: string; next: string; pageOf: string /* 'Page {page} of {count}' */; total: string /* '{total} rows' */; pageSize: string }` + `DEFAULT_LABELS`(labels.ts,英文)
  - `useConfigTable(config: TableConfig, source: TableSource): { rows; total?: number; page; pageCount?: number; sort?: SortState; toggleSort(key): void; setPage(p): void; nextPage(): void; prevPage(): void; canPrev; canNext; pageSize; setPageSize(n): void; loading; error?: string; retry(): void; strategy: 'client' | 'offset' | 'page' | 'cursor' }`
- 本任務只實作 **靜態(client)** 路徑:`sortRows` + slice 分頁;sort 初值 `config.defaultSort`;`toggleSort(key)` 同鍵翻轉方向、換鍵設 asc 並回第一頁;`setPageSize` 回第一頁。remote 路徑丟 `not implemented` 佔位(Task 6 完成)。

- [ ] **Step 1: 寫失敗測試**(`renderHook` @testing-library/react;靜態 25 列):初始 rows=前 pageSize 筆、total=25、pageCount=3;`nextPage` 後第二頁;`toggleSort('age')` 排序生效且回第一頁、再 toggle 反向;`setPageSize(5)` 回第一頁 pageCount=5;`visible` 與 hook 無關(rows 原样回傳 —— 欄位顯隱是渲染層的事)。
- [ ] **Step 2: 確認失敗** → **Step 3: 實作**(含腳手架、changeset;`pnpm install` 讓 workspace 連結)→ **Step 4: `pnpm -F @rfjs/table-builder-ui vitest:run && pnpm -F @rfjs/table-builder-ui check-types` 全綠** → **Step 5: Commit**(`feat(table-builder-ui): scaffold package with client-mode useconfigtable hook`)

---

### Task 6: `useConfigTable` 遠端來源(三種分頁 + 排序 refetch + 錯誤重試)

**Files:**
- Modify: `packages/table-builder-ui/src/use-config-table.ts` + `use-config-table.spec.ts`

**Interfaces:**
- Consumes: data-schema `buildRequestParams`/`extract*`(經 table-builder re-export 或直接依賴 —— 從 `@rfjs/table-builder` import,它已 re-export;若未 re-export 則在 Task 6 於 table-builder index 補)。
- 行為(spec §5.2):
  - offset/page:state.page(1 起算 UI 頁碼)→ `buildRequestParams`(offset=pageToOffset;page 策略用 firstPage 換算 API 頁碼)→ `source.fetch` → `extractRows`/`extractTotal`;pageCount 由 total 算(無 total → undefined,`canNext` 以「本頁滿頁」推定)。
  - cursor:維護游標堆疊(`cursors: (string | undefined)[]`,index = UI 頁-1);`canNext` = 最近一次 `extractCursor` 有值;`setPage` 不可用(no-op);total/pageCount undefined。
  - 排序改變 → 清游標堆疊、回第一頁、重新 fetch;fetch 進行中 loading=true;reject → `error = message`、rows 保留上一次成功值;`retry()` 重跑當前請求。
  - 競態:效應內 epoch/cancelled 防護(比照 use-data-source 慣例);unmount 不 setState。

- [ ] **Step 1: 寫失敗測試**(mock fetch;每策略一組):offset — 第 1 頁參數 `{limit,offset:'0'}`、next 後 `offset:'10'`、total 驅動 pageCount;page — firstPage 0 時第 1 UI 頁帶 `page:'0'`;cursor — 首頁無 cursor 參數、回應給 cursor 後 `canNext` true、next 帶 cursor、prev 回上頁(用堆疊,不重新要 cursor)、末頁(無 cursor)`canNext` false;排序改變 → fetch 參數含 sort 且回第一頁;reject → error 設定且 `retry()` 成功後清除;快速連續 toggleSort 兩次 → 只有最後一次結果生效(競態)。
- [ ] **Step 2: 確認失敗** → **Step 3: 實作** → **Step 4: 全綠 + check-types** → **Step 5: Commit**(`feat(table-builder-ui): add remote source with offset/page/cursor pagination and retry`)

---

### Task 7: `<ConfigTable>` 元件

**Files:**
- Create: `packages/table-builder-ui/src/config-table.tsx` + `config-table.spec.tsx`(index.ts 補 export)

**Interfaces:**
- Produces: `ConfigTable({ config, source, labels?, locale? }: { config: TableConfig; source: TableSource; labels?: Partial<TableLabels>; locale?: string })`
- 行為(spec §5.3):web-ui `Table/TableHeader/TableBody/TableRow/TableHead/TableCell` 渲染;`visible: false` 欄不渲染;欄順序 = pin left 群(依原順序)→ 無 pin → pin right 群;sortable 標頭 `<button>` 可點(呼叫 hook `toggleSort`),目前排序鍵顯示 ↑/↓(lucide `ArrowUp/ArrowDown`);儲存格 `formatCell`;`align` 未指定 numeric→right 其餘 left(`text-right` 等 class);pin 欄 `sticky` + 背景 + 邊界陰影 class(左群 `left-0`,offset 以 CSS 變數/測量處理 —— 單欄 pin 為主要案例,多欄 pin 用 `useLayoutEffect` 量測 th 寬累加 offset);分頁列:offset/page → `pageOf`/`total` 文案 + prev/next(cursor → 僅 prev/next);`pageSizeOptions` 有值才渲染 pageSize select;三態:loading(骨架或文案)、error(文案+retry 按鈕)、空(`config.emptyText` resolveLabel 或 `labels.empty`);labels = `{ ...DEFAULT_LABELS, ...labels }`,`pageOf`/`total` 用 `{page}`/`{count}`/`{total}` 字串替換(簡單 replace,不引 i18n 庫)。

- [ ] **Step 1: 寫失敗測試**(jsdom):靜態 rows 渲染列數 = pageSize;`visible:false` 欄不出現;點 sortable 標頭 → 首列改變 + 圖示出現;分頁列文字(`Page 1 of 3`、`25 rows`)+ next 後第二頁;pin left 欄的 th/td 有 sticky class;numeric 欄 td 有 text-right;空 rows → emptyText;remote error(mock reject)→ error 文案 + 點 retry 後(mock resolve)恢復;labels 覆寫(`{ empty: '沒有資料' }`)生效;cursor 模式不渲染頁碼文案只有 prev/next。
- [ ] **Step 2: 確認失敗** → **Step 3: 實作** → **Step 4: 全綠 + check-types** → **Step 5: Commit**(`feat(table-builder-ui): add configtable component with sorting, pinning and pagination ui`)

---

### Task 8: 工具腳手架 + 註冊(共用檔 append)

**Files:**
- Create: `apps/web/src/tools/table-builder/{index.ts,messages.ts,sample.ts,fake-fetcher.ts}` + `{sample,fake-fetcher}.spec.ts` + 最小 `ui.tsx`(先渲染 `<ConfigTable>` 靜態預覽,editor 面板 Task 9)
- Modify(append):`packages/web-core/src/registry/tools.ts`、`packages/web-core/src/registry/packages.ts`、`apps/web/src/tools/index.ts`、`apps/web/src/tools/messages.ts`、`apps/web/src/tools/index.spec.ts`(EXPECTED_WEB_TOOL_IDS)、`apps/web/next.config.js`(transpilePackages += `@rfjs/table-builder-ui`)、`apps/web/package.json`(deps += `@rfjs/data-schema`、`@rfjs/table-builder`、`@rfjs/table-builder-ui` workspace:*)
- Modify(append):`apps/web/src/messages/{en,zh-TW}.json` 的 `Packages` 段(`data-schema`、`table-builder` 兩鍵 —— **#224 的教訓**:`i18n-content.spec.ts` 會驗 packageRegistry 每個條目都有對應鍵)

**Interfaces:**
- registry 條目照 spec §6.3(tools.ts:id `table-builder`、category `generator`、surface `web`、status `preview`、relatedPackages/tags;packages.ts:兩條目,shape 比照 `@rfjs/decision-table` 條目含 github/relatedTools)。
- `sample.ts`:`SAMPLE_ROWS`(15-20 筆,含 string/numeric(currency)/date/boolean/巢狀 `author.name`/enum options 欄)+ `SAMPLE_META: DataResourceMeta`(fields + offset request + response)+ `SAMPLE_CONFIG = deriveTableConfig(SAMPLE_META)` 微調(部分欄 sortable、一欄 pin left)。
- `fake-fetcher.ts`(spec §6.2):`makeFakeFetcher(rows)` 回傳 `(built: BuiltRequest) => Promise<unknown>` —— 解析 params 依三策略分頁 + server 排序模擬(用 table-builder `sortRows`)+ `setTimeout` 120ms 延遲;回應形狀 `{ data: { items, total, nextCursor? } }` 與 SAMPLE_META 的 response paths 一致。
- messages.ts:`Tools['table-builder']` title/description(en+zh-TW)+ `ToolUI` `tb*` 前綴鍵(Task 9 的 editor 文案一併定義;placeholder 走 `t()`)。

- [ ] **Step 1: 寫失敗測試**:`sample.spec.ts`(SAMPLE_META 過 `parseDataResourceMeta`;SAMPLE_CONFIG 過 `parseTableConfig`);`fake-fetcher.spec.ts`(offset 第二頁回第 11-20 筆;sort 參數生效;cursor 回 nextCursor 且末頁無);`apps/web/src/tools/index.spec.ts` EXPECTED 加 `"table-builder"`(此為紅測試 → 註冊後轉綠)。
- [ ] **Step 2: 確認失敗** → **Step 3: 實作**(全部檔案 + append;`pnpm install` 連結新 deps)→ **Step 4:** `pnpm -F web vitest:run src/tools/index.spec.ts src/tools/table-builder/ src/lib/i18n-content.spec.ts && pnpm -F web check-types && pnpm -F @rfjs/web-core test` 全綠 → **Step 5: Commit**(`feat(web): register table-builder tool with sample data and fake fetcher`)

---

### Task 9: 工具 editor 面板 + 即時預覽

**Files:**
- Create: `apps/web/src/tools/table-builder/{source-panel.tsx,columns-panel.tsx,pagination-panel.tsx}` + 對應 `.spec.tsx`
- Modify: `apps/web/src/tools/table-builder/ui.tsx` + `ui.spec.tsx`、`messages.ts`(補漏鍵)

**Interfaces(spec §6.1,上編輯三面板並排 / 下全寬 `<ConfigTable>` 預覽):**
- `ui.tsx` 持 state:`config: TableConfig`(初值 SAMPLE_CONFIG)、`sourceMode: 'rows' | 'offset' | 'page' | 'cursor'`;source 由 mode 組(rows → SAMPLE_ROWS;remote → SAMPLE_META 對應策略的 request/response + `makeFakeFetcher`,page/cursor 模式的 request 需在 sample.ts 提供三份或由函式產生)。
- `source-panel.tsx`:mode 切換(radio/segmented)。
- `columns-panel.tsx`:每欄一列 —— 原生 HTML5 拖拉排序(`draggable` + dragstart/dragover/drop,重排 `config.columns`)、visible checkbox、label 文字輸入(string 編輯)、format select(依 dataType 過濾合法選項;空 = 無)、sortable checkbox、pin 三態切換(無/left/right)。
- `pagination-panel.tsx`:pageSize number、emptyText 文字輸入。
- 預覽:`<ConfigTable config={config} source={source} labels={fromNextIntl} locale={locale} />`,任何編輯即時反映。

- [ ] **Step 1: 寫失敗測試**:columns-panel — visible 取消勾選 → onChange 收到 `visible: false`;format select 對 string 欄不含 currency 選項;pin 切換寫入;拖拉(fireEvent dragstart/dragover/drop)重排順序;ui.spec — 預設渲染表格(列數 = pageSize)、切 offset 模式後仍渲染(mock 或真 fake-fetcher + waitFor)、改 pageSize 立即反映。
- [ ] **Step 2: 確認失敗** → **Step 3: 實作** → **Step 4:** `pnpm -F web vitest:run src/tools/table-builder/ && pnpm -F web check-types && pnpm -F web lint` 全綠 → **Step 5: Commit**(`feat(web): add table-builder editor panels with live preview`)

---

### Task 10: 雙語 README ×2

**Files:**
- Create: `packages/data-schema/{README.md,README.zh-TW.md}`、`packages/table-builder/{README.md,README.zh-TW.md}`

結構比照 `packages/decision-table/README*.md`(先讀它):標題+一句定位、互連(zh↔en 連結)、Install、Quick start(data-schema:定義 meta → infer → buildRequestParams/extract;table-builder:deriveTableConfig → sortRows/formatCell)、API 表、與家族套件的關係(data-schema ← table-builder ← table-builder-ui/result item)、License。程式碼範例必須是可執行的真 API(從本分支 src 對照)。

- [ ] **Step 1-2: 撰寫**(無 TDD;內容準確性由 review 把關)→ **Step 3: Commit**(`docs(data-schema,table-builder): add bilingual readmes`)

---

### Task 11: e2e + 全套驗證

**Files:**
- Create: `apps/web/e2e/table-builder.e2e.ts`

```ts
import { test, expect } from "@playwright/test";

const URL = "/en/tools/table-builder";

test("renders the sample table and paginates", async ({ page }) => {
  await page.goto(URL);
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  const firstCell = await rows.first().textContent();
  await page.getByRole("button", { name: /next/i }).click();
  await expect(rows.first()).not.toHaveText(firstCell ?? "", { timeout: 15_000 });
});
```

（selector 以實作為準微調,不得放寬成 truthy。）

- [ ] **Step 1: 追加測試** → **Step 2:** `pnpm -F web test:e2e` 全 PASS → **Step 3:** `pnpm -F @rfjs/data-schema test && pnpm -F @rfjs/table-builder test && pnpm -F @rfjs/table-builder-ui test && pnpm -F web test && pnpm -F @rfjs/web-core test` 全 PASS;`pnpm -F workbench build` 通過(**#230 的教訓**:workbench 也吃 web-core,發 release 前要能 build)→ **Step 4: Commit**(`test(web): cover table-builder rendering and pagination in e2e`)

---

### Task 12: 終審(多鏡頭 workflow)+ 真渲染截圖 + PR(主 session 執行,非 subagent)

- [ ] **Step 1: 多鏡頭終審**(Workflow:四鏡頭並行 —— correctness/契約一致、打包發布正確性(package.json/exports/files/changesets)、註冊完整性(registry/i18n/transpilePackages/EXPECTED)、UI 行為與 spec §5 對照;各鏡頭產 findings 後交叉否證,Critical/Important 派單一 fixer)。
- [ ] **Step 2:** `pnpm -F web build` → `next start -p 3008` → Playwright 截圖 light/dark:預設表格(排序圖示、pin 陰影、分頁列)、切 cursor 模式(prev/next only)、columns 面板操作後預覽變化、空狀態。
- [ ] **Step 3:** 截圖貼給使用者 → push + `gh pr create`(HOLD)。PR 要點:三個新套件 + 工具、TableConfig 接縫(result item follow-up 另開)、changesets ×3、README ×2。
