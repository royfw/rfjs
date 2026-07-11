# filter → API dogfood(Next.js 假 route + 共享契約 + 場景旋鈕 + 最小接線)— 設計 spec

- 日期:2026-07-11
- 分支 / worktree:`feat-filter-api-dogfood` @ `.claude/worktrees/feat-filter-api-dogfood`(off main `d776c79`)
- 背景 memory:`rfjs-table-builder-line`(#240 remote filter contract + apply-driven ConfigTable;fetch seam 目前是 in-process 函式,非 Next route)、`rfjs-form-tool-consolidation`(dogfood = 唯一缺 transport)
- 狀態:設計已與使用者逐叉路確認,待 spec review → plan

---

## 1. 背景與目標

table-builder-ui 的 remote filter 管線(#240)已建好且測過:`applyFilter → treeToPgFilterGroup → buildRequestParams → source.fetch(built)`。**唯一是假的是 `source.fetch` 本身**——目前只有 in-process `makeFakeFetcher`(一個 JS 函式,沒有網路)。`apps/web/src/app/api/` 底下**沒有任何 filter-query route**。

**目標**:補上那根 transport,讓 table 的 filter 走**真 HTTP 往返**——不必起 Postgres / apps-api:

- **假 route**:一個 Next.js route,收工具送出的請求、伺服端執行 filter、回結構化 rows。
- **場景旋鈕**:能故意觸發 loading / error / 空 三種 UI 態。
- **最小客端接線**:把 table-builder 工具的 remote 來源接到 route,瀏覽器 UI 當場端到端點亮。
- **共享契約**:request/response 型別,route 與(未來)transport 共用。

**成功判準**:table-builder 切到「remote (HTTP)」來源 → 打 filter → Apply → 一發真 HTTP POST 到 `/api/query/customers` → 伺服端篩 → 表格渲染篩後 rows;旋鈕能演示 loading/error/空。

---

## 2. 非目標(out of scope)

- **不接真 apps/api / Postgres**(見 §7 的誠實修正:apps/api 是不同契約,需 adapter,屬 #13/workbench 那條線)。
- **不改 `packages/*`**——contract、route、transport、wiring 全在 `apps/web`;filter 執行**消費**既有 `@rfjs/filter-builder` / `@rfjs/pg-filter` / `@rfjs/table-builder-ui`。
- 不做 cursor 策略的旋鈕演示(pagination 先只 offset/page;route 仍原生支援 cursor 因邏輯複用 fake-fetcher)。
- 不碰 #14 的 package 級 http-fetcher(見 §7 協調)。
- 不做 form-builder 端接線(這輪接 table-builder)。

---

## 3. 契約(誠實修正:採「工具原生慣例」,非 apps/api 結構化 body)

> **修正說明**:brainstorm 早期口頭說「body 鏡像 apps/api、零改動對換」。讀 code 後修正:工具 remote 端天生產出的是 `BuiltRequest`(params 為字串化分頁/排序 + 不透明 filter),response 慣例是 `{ data: { items, total, nextCursor? } }`(見 `fake-fetcher.ts:12-13`、`SAMPLE_META.response`)。apps/api 收的是結構化 `{ filter, sort: SortSpec[], page, pageSize }` 且回 `{ items, total, page, pageSize }`——**兩種慣例不同(尤其 sort)**。最小且最真的 dogfood 是讓 route 講**工具原生慣例**、複用現有 fake-fetcher 邏輯;當 apps/api 的替身需一層 adapter,留給 #13。

**Request(POST body)** = 工具送出的 `BuiltRequest`(`@rfjs/data-schema`):
```ts
type BuiltRequest = { endpoint: string; method: string; params: Record<string,string>; filter?: PgFilterGroup }
```
transport 直接把 `built` JSON 化當 body POST 出去(resource 由 URL path 帶,不進 body)。

**Response** = `{ data: { items: Record<string,unknown>[]; total: number; nextCursor?: string } }`(對齊 `SAMPLE_META.response` 的 rowsPath `data.items` / totalPath `data.total`)。

**共享契約型別**放 `apps/web/src/lib/query-contract.ts`(引用 `@rfjs/data-schema` 的 `BuiltRequest`、`@rfjs/pg-filter` 的 `PgFilterGroup`),route 與 transport 共用。

---

## 4. 伺服端查詢引擎(DRY:抽出 fake-fetcher 的純邏輯)

`fake-fetcher.ts` 現有的純函式(`applyPgFilter` reverse+`runLiveMatch`、`parseSort`、`paginate`、`sortRows`)正是 route 要的伺服端執行。**抽成共享純模組** `apps/web/src/lib/fake-query.ts`:

```ts
// 純、無網路、無 React;in-process fake-fetcher 與 HTTP route 都消費它
export function runQuery(
  rows: Record<string, unknown>[],
  columns: TableColumnConfig[],
  fields: DataFieldMeta[],
  built: { params: Record<string,string>; filter?: unknown },
): { items: Record<string,unknown>[]; total: number; nextCursor?: string }
```
- 內部 = 現有 `applyPgFilter`(pg group → `pgGroupToFilterGroup` → `filterGroupToTree` → `runLiveMatch`)+ `parseSort` + `sortRows` + `paginate`,原封不動搬過來。
- `makeFakeFetcher` 改成薄殼:`runQuery(...)` 再包 `{ data }` + delay(行為不變,既有 table-builder 測試應續綠)。

---

## 5. Next.js 假 route

`apps/web/src/app/api/query/[resource]/route.ts`(POST):

```
1. 解析 resource(path)+ 讀 URL searchParams 的旋鈕(delay/error/empty)
2. 旋鈕:error → 回對應 HTTP 錯誤碼;delay → await 指定 ms;empty → rows 視為 []
3. body = BuiltRequest(zod 驗:params 物件、filter 選填)
4. resource registry 查 { rows, columns, fields };未知 → 404
5. result = runQuery(rows, columns, fields, built)   // §4 共享引擎
6. 回 { data: result }
```

**場景旋鈕(query params)**:
- `?delay=<ms>` → 伺服端延遲(看 loading)。
- `?error=<code>` → 回 4xx/5xx(看 error 態)。
- `?empty=1` → 回 0 筆(看空態)。

**資源 registry**(`apps/web/src/lib/query-resources.ts`):至少 `customers`——`~50` 列、混 column 與 jsonb-ish 欄位(id/name/email/amount/status + 一個巢狀 profile),欄位帶 `filterable`+`kind`,供 filter 演示。可複用 / 擴充 table-builder 現有 `SAMPLE_ROWS`/`SAMPLE_META`。

---

## 6. 最小客端接線(table-builder)

`apps/web/src/tools/table-builder/`:
- 新增 `http-fetcher.ts`:`makeHttpFetcher(endpoint): (built) => Promise<unknown>` = `fetch(endpoint, { method:'POST', headers, body: JSON.stringify(built) }).then(r => { if(!r.ok) throw ...; return r.json() })`。
- `ui.tsx:170-181` 的 `source` useMemo:`sourceMode` 增加一個 `"remote-http"`(或把既有 remote 分支的 `fetch` 依 toggle 換成 `makeHttpFetcher("/api/query/customers")`),**保留** in-process fake 分支不動。UI 加一個來源切換(rows / remote (in-memory) / remote (HTTP))。

> 只動 apps/web tool 檔;消費 `@rfjs/table-builder-ui` 既有 `kind:'remote'` 支援,**不改 package**。

---

## 7. 紅線 / 與 #14、apps/api 的關係

- **紅線**:不改 `packages/*`。全部在 `apps/web`(app route + lib + tool)。
- **與 #14(http-fetcher,目前無 PR)**:我的 `makeHttpFetcher` 是 **app 級、最小、可升級**的 transport。若 #14 之後落地 package 級版本,把工具的 `fetch` 換成它即可;兩者共用同一 fetch 簽名(`(built)=>Promise<unknown>`)與契約,收斂點在契約。這輪**不進 package**,避免撞 #14/#245 地盤。
- **與 apps/api**:apps/api `/datasets/query` 是**不同契約**(結構化 body + `{items,total,page,pageSize}` 回應)。要當它的真替身需 request/response adapter(BuiltRequest ↔ QueryDatasetsBody;params↔structured sort)——**屬 #13/workbench 那條線,非本輪**。本輪只證明「工具 remote 管線 → 真 HTTP → 伺服端篩 → rows 回表格」。

---

## 8. 測試策略

- **`fake-query.spec.ts`(純)**:給 rows + PgFilterGroup(column & jsonb 葉)+ sort + offset/page params → 斷言篩/排/分頁正確;空 filter → 全量;uncoverable → 全量不誤 0。
- **route 整合測試**:對 route handler 打 `BuiltRequest`(直接呼叫 handler 或 `fetch` 測試伺服器)→ 斷言 `{data:{items,total}}`;未知 resource 404;`?error=500` → 500;`?empty=1` → 0 筆。
- **`http-fetcher.spec.ts`**:mock `fetch`,斷言 POST body = JSON 化 built、非 2xx → throw。
- **table-builder 既有測試**:`makeFakeFetcher` 重構後行為不變,續綠。
- **UI e2e / 截圖**:table-builder 切 remote(HTTP)→ filter → Apply → 表格更新;旋鈕演示 loading/error/空(見 §9)。

---

## 9. 驗證 / 截圖

worktree 起 dev(非 3000 埠),playwright(bundled chromium)驅動 table-builder:切「remote (HTTP)」來源、開 filter、Apply → 截 happy(篩後 rows);再以旋鈕 URL 截 loading / error / 空。手法沿用 #243 那次(bundled chromium executablePath + 自寫腳本)。

---

## 10. Changeset

- 全部在 `apps/web` → **無 changeset**(app 不記版本,依 changeset policy)。

commits 英文 conventional + `Co-Authored-By` trailer;spec/plan 繁中。

---

## 11. 風險與待決

1. **與 #14 收斂**:app 級 transport 是刻意的過渡;#14 落地後升級(§7)。若使用者希望這輪就做成 package 級,需重新界定紅線。
2. **契約非 apps/api 對齊**(§3/§7 誠實修正):本輪證明工具↔假 route;apps/api 對接是 #13 的 adapter。若使用者要這輪就對齊 apps/api,範圍加大(要解 params↔structured sort 映射)。
3. **route 執行環境**:`runQuery` 依賴 `@rfjs/filter-builder`/`data-filter`(純 JS)+ `crypto.randomUUID`——Next route 的 Node runtime 可用;必要時 `export const runtime = 'nodejs'`。
4. **來源切換 UX**:table-builder 多一個來源模式,注意別破壞既有 rows/remote 切換與 e2e。
