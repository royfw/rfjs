# 設計文件：`@rfjs/es-query` + `@rfjs/es-client`

**日期：** 2026-06-25
**狀態：** 設計已核可 — 可進入實作規劃
**分支 / worktree：** `worktree-feat-es-query`（`.claude/worktrees/feat-es-query`）

## 1. 目標

為 rfjs 的 filter / query-builder 套件群補上 Elasticsearch / OpenSearch 查詢層，
定位為 `@rfjs/mongo-query`、`@rfjs/jsonb-query` 的 ES 版手足：把一棵 filter-tree
編譯成 Elasticsearch / OpenSearch Query DSL 的 `bool` query。接著提供一個**不硬綁任何
client 函式庫**的執行層（search + 深分頁 + highlight），並把建構器接進視覺化的
`filter-builder`，讓既有的 tree 編輯器也能以 ES / OpenSearch 為目標。最後在 `apps/web`
放一個互動式 demo。

**只支援現代 Elasticsearch（8.x / 9.x）與 OpenSearch（2.x / 3.x）** —— 不支援舊版
ES2 / ES5 / ES7 mapping type，也不做多版本 client factory。

## 2. 套件

兩個分層套件（對應 `sql-filter` 純核心 / `pg-filter` 組合 的切法）。

### 2.1 `@rfjs/es-query` — 純建構器（零依賴、可發布 npm）

- 輸入：一棵 filter-tree（自有的 ES-aware leaf 型別，見 §4）。
- 輸出：ES / OpenSearch 的 **search request body（不含 index）**：
  `{ query, sort?, size?, from?, search_after? }`。
- `dialect: 'elasticsearch' | 'opensearch'` 用來閘住少數分歧子句（見 §5）。
- 零執行期依賴。純函式、可完整單元測試。無 client、無網路。

### 2.2 `@rfjs/es-client` — 執行 + 周邊（依賴 `es-query`）

Client 無關：**不**把 `@elastic/elasticsearch` 或 `@opensearch-project/opensearch`
放進 `dependencies`。改為定義一個 `SearchTransport` 契約，並提供
`fromElasticClient(client)` / `fromOpenSearchClient(client)` 兩個 adapter 去包裝使用者
自帶的 client。client 與其版本由使用者自行擁有。

範圍（已確認）：

- **D — 輕量 search 包裝**（執行層脊椎）：透過注入的 transport 做 `search` / `count` /
  `msearch`，含錯誤正規化與 `hits → sources` 對映。
- **A — 深分頁**：`search_after` + Point-In-Time（PIT）快照，包成 async iterator / 批次
  helper。取代已被官方不建議的 `scroll` API。
- **B — 通用 highlight**：組 `highlight` 請求區塊（pre/post tags、各欄位 fragment 設定），
  並把回應的 `hit.highlight` 解析成通用的 `{ [field]: string[] }` 結構。
  （不含任何業務專屬 / VTT-cue 解析。）

延後到 **phase 2**：**C — aggregation builder**（metadata → ES aggregations），以及從
線上 ES `_mapping` API 自動推導 field-schema。

## 3. 整合點

```
@rfjs/es-query  ──註冊為 engine──▶  @rfjs/filter-builder  (getEngine('es-query'))
       │                                    │
       │                                    ▼
       │                           @rfjs/filter-builder-ui  (tree 編輯器；ES 運算子
       │                                    │                只在 target = es-query 時顯示)
       ▼                                    ▼
@rfjs/es-client（執行）          apps/web tool：es-query 互動 demo
```

- **filter-builder engine**：註冊 `getEngine('es-query')`，把 canonical builder tree →
  `es-query` 輸入 → ES query JSON。group 邏輯與運算子對映見 §4。
- **filter-builder-ui**：ES 專屬運算子由 engine 自己宣告（沿用既有的 `arity.ts` +
  `operators()` 機制，單一真實來源），且只在目前目標為 `es-query` 時顯示；其他 engine
  的運算子集不受影響。
- **apps/web**：在 `src/tools/es-query/` 新增一個 registry 驅動的 tool —— 左欄編輯
  filter-tree（複用 `filter-builder-ui`），右欄即時顯示編譯出的 ES / OpenSearch query
  JSON，並有 `dialect` 切換。自含模組：`index.ts` 描述子、`ui.tsx`（`"use client"`）、
  純邏輯檔、`messages.ts`（en + zh-TW）、co-located `*.spec.ts`。
- **packageRegistry**（`@rfjs/web-core`）：登錄兩個新套件。

## 4. 建構器模型（`es-query`）

### group 邏輯 → `bool`

| tree group | bool 子句 |
|---|---|
| `and` | `must` |
| `or`  | `should`（+ `minimum_should_match: 1`） |
| `not` | `must_not` |
| `nor` | `must_not` |

巢狀 group 遞迴成巢狀 `bool` query。

### 運算子 = ES 原生子句（已確認的模型）

使用者直接選 ES 子句（與原本 `ClauseType` 模型一致 —— 明確、零猜測）。**選填**的
field-schema 讓抽象運算子（`eq`、`in`…）依欄位型別自動解析成 `term` 或 `match`；
未提供 schema 時走保守預設（例如字串 → `term` / keyword）。

| 運算子 | ES / OpenSearch 子句 |
|---|---|
| `eq` / `neq` | `term`（keyword）或 `match`（text）；`neq` 包進 `must_not` |
| `in` / `notIn` | `terms` |
| `lt` / `lte` / `gt` / `gte` / `between` | `range` |
| `contains` / `startsWith` / `endsWith` | `wildcard` / `prefix` |
| `exists` / `isNull` | `exists` |
| `match` / `matchPhrase` / `multiMatch` | `match` / `match_phrase` / `multi_match` |
| `combinedFields` | `combined_fields` ✱ |
| `fuzzy` | `fuzzy` 或帶 `fuzziness` 的 `match` |
| `regex` | `regexp` |

✱ 受 dialect 閘控（見 §5）。

### 欄位型別感知

`es-query` 接受選填的 `fields` schema（`{ [path]: 'keyword' | 'text' | 'date' |
'number' | 'boolean' }`）。它據此決定 `term` vs `match`、date/number 的 `range` 轉換等。
未提供時走保守預設，且**不做任何網路 / mapping 查詢**（保持建構器純粹）。允許 per-leaf
覆寫。

### sort 與分頁形狀

`es-query` 同時產出 `sort`（由 order-by metadata）與分頁欄位（`from`/`size`，或
`search_after` 游標）。`es-client` 執行時消費這些。

## 5. ES vs OpenSearch（`dialect`）

共用的 `bool` / `term` / `terms` / `range` / `match` / `wildcard` / `fuzzy` / `exists`
DSL 在現代 ES 與 OpenSearch 之間完全相同（OpenSearch fork 自 ES 7.10），所以建構器以
近乎零成本同時支援兩邊。只有分歧子句由 `dialect` 閘控，沿用 `jsonb-query` 的 dialect
契約 + 型別化錯誤：

- `combined_fields` —— ES 7.13+；OpenSearch 不保證支援 → 對不支援的目標報錯。
- ES 9 retrievers、OpenSearch `neural` / hybrid pipeline —— **範圍外**（偏執行層與
  mapping，不適合純 metadata 查詢建構器）。

目前 dialect 不支援的子句 → 在編譯期丟出明確的型別化錯誤（如 `jsonb-query` 的
`errors.ts`）。

## 6. 執行模型（`es-client`）

```ts
type SearchTransport = (req: SearchRequest) => Promise<SearchResponse>
// adapter（不硬綁任一 client 函式庫）：
fromElasticClient(client)      // @elastic/elasticsearch
fromOpenSearchClient(client)   // @opensearch-project/opensearch
```

- `search` / `count` / `msearch`：吃 `es-query` body + 一個 `SearchTransport`，執行、
  正規化錯誤、把 `hits → sources` 對映。
- `paginateAll`：開一個 PIT，用上一頁最後一筆的 `sort` 值當游標迴圈 `search_after`，
  結束時關閉 PIT。PIT 開關在 ES 與 OpenSearch 間有差異，於 transport adapter 內部處理。
- `highlight`：設定建構器 + 回應解析器（通用 `{ field: string[] }`）。

## 7. 測試 / 打包 / 文檔

- **測試**：`*.spec.ts` co-located（vitest 單元）。`es-query` 為純函式 → 直接好測。
  `es-client` 以 fake `SearchTransport` 測。真實 ES / OpenSearch 的 E2E 走
  `vitest.config.e2e.mts`，可選 / phase 2。
- **打包**：tsdown + `tpl-toolkit` config 工廠，與其他 `@rfjs/*` 一致。
- **發布**：加 changeset；兩者登錄 `packageRegistry`。
- **文檔**：每個套件附 README（en + zh-TW），**只用中性範例** —— 不引用任何抽取這些模式
  的來源專案。

## 8. 範圍外（本次迭代）

- Aggregation builder（phase 2）。
- 從線上 `_mapping` API 自動推導 field-schema（phase 2）。
- ES client / scroll / percolate / health，以及任何業務專屬 highlight（如 VTT-cue）解析。
- Semantic / kNN / 向量 / retrievers / RRF / OpenSearch neural search。

## 9. 建置順序（高階）

1. `@rfjs/es-query` —— 型別 + dialect 契約 + group/運算子 編譯 + sort + errors。
2. `@rfjs/es-client` —— `SearchTransport` + adapters + search 包裝 + 分頁 + highlight。
3. `filter-builder` engine 註冊（`getEngine('es-query')`）+ 運算子宣告。
4. `apps/web` 互動 demo tool + i18n。
5. README（en + zh-TW）、changeset、registry 登錄。
