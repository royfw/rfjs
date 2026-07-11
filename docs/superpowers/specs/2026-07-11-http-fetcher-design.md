# package 級擬真 http-fetcher + metadata-builder 試打 endpoint(#14)— 設計 spec

- 日期:2026-07-11
- 分支 / worktree:`feat-table-builder-http-fetcher` @ `.claude/worktrees/feat-table-builder-http-fetcher`(off main `2e14fc2`)
- 背景 memory:`rfjs-table-builder-line`(#247 app 級 dogfood 已 merged;#14 = package http-fetcher + metadata-builder 試打鈕,原「app 級 transport 可被 #14 supersede」)
- 狀態:設計已與使用者逐叉路確認(擬真式 B、試打回應放 protocol 區),待 spec review → plan

---

## 1. 背景與目標

#247 在 app 級做了 `makeHttpFetcher`(信封式:整包 `BuiltRequest` 當 body POST,只對自家假 route 有意義)。#14 把它**升級成 package 級的「擬真」transport**,並讓 metadata-builder 能**試打**使用者 author 的 endpoint。

**目標:**
- **擬真 fetcher**:依 `RequestMeta`(method / filter param)把 `BuiltRequest` 序列化成真後端形狀的 HTTP 請求(GET querystring / POST body),放進 `@rfjs/table-builder-ui`(`TableSource` 的主人)。
- **table-builder** 改用它(移除 #247 的 app 級 fetcher)。
- **#247 假 route** 更新成讀擬真格式(table-builder demo 續通)。
- **metadata-builder 試打鈕**:用 author 的 `meta.request` 打一發、就近顯示回應/錯誤。

---

## 2. 非目標(out of scope)

- **UI 一致性/佈局視覺輪**(table-builder 向 metadata-studio 靠攏)——那是**另一輪**;本輪 table-builder **無視覺改動**,metadata-builder 只加一顆功能鈕(沿用既有 studio 樣式)。
- 不接真 apps/api(結構化 body 不同,需 adapter = #13)。
- 不做 GET 以外/POST 以外的傳輸;filter 只走 `filter` param 慣例(對齊 sample 的 `filter:{style:'pg',param:'filter'}`)。

---

## 3. 擬真 wire format(依 `buildRequestParams` 實際輸出)

`buildRequestParams(request, state, filter?)` 產出 `built = { endpoint, method, params: Record<string,string>, filter? }`:`params` = 分頁+排序字串(param 名來自 RequestMeta);`filter` = 不透明值;**filter 的 param 名只在 `RequestMeta.filter.param`,不在 built**。故 fetcher 需 `makeHttpFetcher(request)`,close over `request.filter?.param` 與 method。

序列化:
- **GET**(`built.method === 'GET'`):`querystring = URLSearchParams(built.params)`;若有 filter → `qs.set(filterParam, JSON.stringify(built.filter))`;`fetch(\`${built.endpoint}?${qs}\`, { method:'GET' })`。
- **POST/其他**:`body = { ...built.params }`;若有 filter → `body[filterParam] = built.filter`;`fetch(built.endpoint, { method: built.method, headers:{'content-type':'application/json'}, body: JSON.stringify(body) })`。
- 非 2xx → `throw new Error('query failed: ' + status)`;回 `res.json()`。

> sample 的 `request` 是 **GET**、`filter param = 'filter'`,故 table-builder demo 會走 GET `/api/query/sample?limit&offset&sort&filter=<json>`。

---

## 4. 檔案範圍與改動

| Piece | 檔案 | 改動 |
|---|---|---|
| **1** package fetcher | `packages/table-builder-ui/src/http-fetcher.ts`(新) | `makeHttpFetcher(request: RequestMeta): (built)=>Promise<unknown>`(§3) |
| | `packages/table-builder-ui/src/index.ts` | `export * from './http-fetcher'` |
| | `packages/table-builder-ui/src/http-fetcher.spec.ts`(新) | GET querystring(含 filter)、POST body、非 2xx throw |
| **2** 假 route | `apps/web/src/app/api/query/[resource]/route.ts` | 加 `GET` handler;抽共用 `extractBuilt`(GET→querystring、POST→body,filter 走 `filter` key;knobs 仍 querystring);共用核心(knobs→resource→runQuery→`{data}`) |
| | `apps/web/src/app/api/query/[resource]/route.spec.ts` | 加 GET cases(含 filter querystring、404、knobs) |
| | `apps/web/src/tools/table-builder/sample.ts` | `SAMPLE_META.request.endpoint` → `/api/query/sample` |
| **3** table-builder 換用 | `apps/web/src/tools/table-builder/ui.tsx` | HTTP 分支 `fetch: makeHttpFetcher(request)`(import 自 `@rfjs/table-builder-ui`) |
| | `apps/web/src/tools/table-builder/http-fetcher.ts` + `.spec.ts` | **刪除**(被 package 版取代) |
| **4** metadata-builder 試打 | `apps/web/src/tools/metadata-builder/protocol-panel.tsx` | 「試打 endpoint」鈕 + 回應/錯誤顯示(protocol 區內);用 `buildRequestParams(request,{pageSize:10})` + `makeHttpFetcher(request)` + `extractRows(res, response)` |
| | `.../protocol-panel.tsx`(DEFAULT_REQUEST) | 預設 endpoint `/api/example` → `/api/query/sample`(showcase 開箱能試) |
| | `apps/web/src/tools/metadata-builder/{ui.tsx,messages.ts}` | ProtocolPanelLabels 加試打相關字串(en + zh-TW,保留其他 locale key) |
| | `.../protocol-panel.spec.tsx` | 試打成功(mock fetch → 顯示 rows 數)+ 錯誤路徑 |

---

## 5. metadata-builder 試打鈕(Piece 4 細節)

- **只在 protocol 啟用**(`request` 有值)時可按;`response` 缺省時降級顯示原始 JSON(不抽 rows)。
- 點擊:
  ```
  built = buildRequestParams(request, { pageSize: 10 })      // 首頁、無 filter
  try { res = await makeHttpFetcher(request)(built)
        rows = response ? extractRows(res, response) : (res as any)
        顯示「N rows」+ 摺疊原始 JSON }
  catch (e) { 顯示錯誤訊息(紅字) }
  ```
- 狀態(loading / result / error)放 `protocol-panel.tsx` 區域內自持(它已有 `request`/`response` props);`buildRequestParams`/`extractRows` 自 `@rfjs/data-schema`、`makeHttpFetcher` 自 `@rfjs/table-builder-ui`。
- 字串走 metadata-builder 既有 i18n(`mb*` messages + ProtocolPanelLabels),en + zh-TW,保留其他 locale key(避免 next-intl {count} 陷阱:不用帶 {count} 的原始訊息,或用 `t(...,{count})`)。

---

## 6. 紅線 / changeset(與前幾輪不同)

- **這輪「刻意」改 `packages/table-builder-ui`**(加 `makeHttpFetcher`)——這正是 #14 的目的(app→package)。table-builder-ui `private`、走 transpilePackages,加 export 即時可用、無 build。目前**無其他線在動它**(#245 已合、無 open worktree)。
- **不破壞既有 surface**:只新增 export;既有 `useConfigTable`/`ConfigTable`/`config-table.spec` 全綠。
- **changeset**:`@rfjs/table-builder-ui` **minor**(新 export;依 changeset policy packages/* 一律給,即使 private = version-only)。apps 不給。

---

## 7. 測試策略

- **package fetcher(`http-fetcher.spec.ts`)**:GET → querystring 含 params + `filter=<json>`;POST(改 method:'POST' 的 request)→ body 含 params + filter key;非 2xx → throw;回傳 json 透傳。mock `fetch`。
- **route(`route.spec.ts`)**:既有 POST cases 續存;加 GET cases——GET 帶 querystring params + `?filter=<json>` → 篩後 `{data:{items,total}}`;未知 resource 404;`?error=500`/`?empty=1` on GET。
- **table-builder**:既有測試續綠;`ui.tsx` 換 fetcher 後 source memo 行為不變(transport 仍在 deps)。移除 app 級 http-fetcher 後無殘引用。
- **metadata-builder(`protocol-panel.spec.tsx`)**:試打成功(mock fetch 回 `{data:{items:[...]}}`)→ 顯示 rows 數;fetch reject → 顯示錯誤;protocol 未啟用時鈕不可按。
- **e2e/截圖**:metadata-builder 開 protocol、按試打 → 顯示回應(打 `/api/query/sample`);table-builder HTTP transport 仍端到端通(GET 版)。

---

## 8. 驗證 / 截圖

worktree 起 dev(非 3000 埠)、bundled chromium 自寫腳本(同 #243/#247):
- table-builder:切 Fake fetcher + HTTP → 表格從 GET `/api/query/sample` 渲染(確認 network 是 GET 帶 querystring)。
- metadata-builder:protocol 開 + 試打 → 回應顯示區出現 rows 數。

---

## 9. 風險與待決

1. **route GET 與 knobs 共用 querystring**:knobs(delay/error/empty)與 params(limit/offset/sort/filter)都在 GET querystring——`extractBuilt` 要把 knobs 排除在 params 外(白名單 knobs / 或 params 取已知分頁排序鍵)。採「先剝除 delay/error/empty/filter,其餘為 params」。
2. **filter param 慣例**:route 假設 filter 走 `filter` key(對齊 sample)。若日後 resource 用別的 param 名,route 需依 resource 的 RequestMeta 解析(本輪 sample 固定 `filter`,不處理)。
3. **試打預設 endpoint**:改 metadata-builder DEFAULT_REQUEST endpoint 為 `/api/query/sample`——注意別破壞既有 protocol-panel 測試(它可能斷言預設值)。
4. **與後續視覺輪**:本輪動 table-builder `ui.tsx`(換 fetcher import)——視覺輪也會動它;本輪先落地,視覺輪 rebase(使用者已定序)。
