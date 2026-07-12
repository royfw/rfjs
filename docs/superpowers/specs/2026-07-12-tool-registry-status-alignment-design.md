# 工具 registry 狀態對齊 — 設計

- 日期:2026-07-12
- 狀態:設計待審
- 範圍:`packages/web-core/src/registry/tools.ts`(+ 一個守門測試)

## 一句話

把 tool registry 的 `status` 徽章對齊現實:6 個明明有完整可用程式碼卻標 `planned` 的工具升級,並依「成熟度」啟用一直空置的 `ready` 階;採 **A 語意(成熟度分級)**。

## 背景與現況

- `status ∈ {ready, preview, planned}`(`schemas.ts:12`),在工具側**純為顯示徽章** —— 工具卡(`tools/page.tsx:39`)、詳情頁(`tools/[slug]/page.tsx:35`)、套件頁(`packages/[slug]/page.tsx:68`)的 `statusLabel`。**無任何 gating/filter/featured**(首頁 featured 用的是**套件** registry 的 `status`,與工具無關)。i18n 標籤(`tStatus`)已存在 → 無新文案。
- 現況:surface:'web' 工具中 **0 個 `ready`**、6 個 `planned`(卻都有 55–110 行實作 + spec)、其餘 `preview`。徽章因此不誠實,且 `ready` 階從未被用。
- `packages` registry 已用 `ready`/`preview` 分級(成熟工具庫=ready)—— 工具側對齊同一套語意。

## 語意(A:成熟度分級)

- **`ready`** = 功能完備、形狀/API 穩定、有測試、其 spec 無待辦 —— 工具不會再改形狀。
- **`preview`** = 能用但仍在迭代:spec 有 Phase-2/deferred 項、近期大改、或依賴尚未上線的東西。
- **`planned`** = 尚未建置(目前無人符合;保留給未來 roadmap 工具)。

## 分派(surface:'web')

**→ `ready`(11)**:`object-flatten`、`type-converter`、`data-filter-tester`、`jwt-decoder`、`jsonb-query-generator`、`mongo-query-generator`(小而完備的 utility/legacy 產生器)+ `data-filter-builder`、`jsonb-query-builder`、`sql-filter-builder`、`mongo-query-builder`、`pg-filter-builder`(filter/query builder 主力,B 階段早出貨、形狀穩)。

**→ `preview`(6,維持)**:`table-builder`(剛大改 Z model)、`metadata-builder`(新工具、剛擴 resource)、`form-builder`(仍有 config-to-zod 日期 / mode:'table' C / a11y deferred)、`es-query-builder`(Phase 2 aggregation 未做)、`es-client-demo`(無 live ES 後端)、`decision-table`(DMN 標準對齊進行中)。

**→ 不動**:`flow-builder`、`bpmn-viewer`(→ 另立的 BPM 專案,維持 `preview`)、`object-transformer`(surface:'workbench'、另議,維持 `planned`)。

判斷取捨備註:`sql-filter-builder` 放 `ready` —— 引擎雖有 deferred 運算子(屬引擎 backlog),但**工具本身**形狀穩、可用。

## 變更清單

- `packages/web-core/src/registry/tools.ts`:11 個 `status` 欄位 `planned`/`preview` → 依上表改(6 個 planned→ready+preview 分派、5 個 preview→ready 升級)。無其他欄位變動。
- **守門測試**(`registry.spec.ts` 增一則):斷言「所有 surface:'web' 且非 flow/bpmn/object-transformer 的工具皆非 `planned`」—— 防止未來新增 web 工具又忘了離開 `planned`。

## 明確不做
- 不動 status 的 UI 呈現、i18n 標籤、schema(三值不變)。
- 不動 `packages` registry。
- 不碰 flow/bpmn/object-transformer(排除範圍)。
- 不新增 status 值(不引入 `stable`/`beta` 等)。

## 驗收
- `pnpm -F @rfjs/web-core test`(含守門測試)+ `pnpm -F @rfjs/web-core check-types` 全過。
- `pnpm -F web test` + `check-types` + `lint` 全綠(工具卡/詳情頁徽章隨之顯示 Ready/Preview)。
- changeset:`@rfjs/web-core` patch(private → version-only)。
- 截圖:工具列表頁徽章反映新分派(至少一 ready + 一 preview)。
