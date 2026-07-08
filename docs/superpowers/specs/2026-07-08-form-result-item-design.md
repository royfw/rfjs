# form-builder result item(api 回應展示區)— 設計規格

日期:2026-07-08
分支:`feat-form-result`(獨立 worktree,基於 `origin/main` @ `5ad3141`)
狀態:已與使用者確認(綁定 = sourceId 選填;dataPath 選填;card 陣列 = 卡片列表 + 上限;table 模式預留透傳)

## 目標

form-builder 系列新增 **`result` item kind**:表單內的 api 回應展示區。與 #232 的 api 按鈕動作銜接 —— 「條件欄位 + api 按鈕 + result 區」組成完整的查詢型表單。

1. **Engine**:`ResultItem` 型別 + zod schema(`mode: 'card' | 'json' | 'table'`;table 為預留變體)。
2. **Renderer(ConfigForm)**:api 動作成功後,回應餵給對應 result item 渲染;含空/loading/錯誤狀態。
3. **工具**:palette「Result」卡、inspector 綁定面板、範例補 api 按鈕 + result 區。

## 非目標(v1 明確不做)

- **table 模式不實作渲染** —— schema 預留 `{ mode: 'table', table?: unknown }` 透傳(另一個並行 session 正在做 `@rfjs/data-schema` + `@rfjs/table-builder`;其 `TableConfig` 落地後由後續 PR 接上)。v1 遇 `mode: 'table'` 渲染占位卡(「Table view — pending table-builder」)。
- 不做 inline 編輯、不做分頁控制(屬 table-builder 範疇)。
- 不動 Submission 面板(它管 payload,result 管畫面)。
- **並行紅線**:不碰 `packages/web-core/**`、`apps/web/src/tools/{index,messages}.ts`、`apps/web/src/tools/index.spec.ts`、`apps/web/next.config.js`、`apps/web/package.json`(歸 table-builder session);本 session 只動 `packages/form-builder*` + `apps/web/src/tools/form-builder/**` + `apps/web/e2e/form-builder.e2e.ts`。

## 1. Engine schema(`packages/form-builder`)

```ts
export interface ResultItem {
  id: string;
  kind: 'result';
  mode: 'card' | 'json' | 'table';
  /** 綁定的 api 按鈕 item id;缺省 = 顯示全域最後一次 api 成功回應。 */
  sourceId?: string;
  /** dot path 先取子節點再渲染(同 api responseMap 的路徑語法);缺省渲染整包回應。 */
  dataPath?: string;
  /** card 模式陣列上限,預設 10;超過顯示「+N more」。 */
  maxItems?: number;
  /** mode:'table' 預留:未來放 @rfjs/table-builder 的 TableConfig;v1 透傳不解讀。 */
  table?: unknown;
  /** 空狀態文案;缺省內建英文 'No result yet'。 */
  emptyText?: LocalizedLabel;
}
```

- `ItemKind` 聯集加 `'result'`;`FormItem` 聯集加 `ResultItem`;zod schema 同步(`mode` enum 必填、`maxItems` 正整數、其餘選填;`table` 用 `z.unknown().optional()`)。
- **`tree-ops` 的 `makeItem` 同步加 `'result'` case**(預設 `{ mode: 'json' }`)—— #232 的教訓,這次列進任務。
- `config-to-zod` 不受影響(result 非資料欄位)。

## 2. Renderer 行為(`packages/form-builder-ui` config-form.tsx)

### 回應狀態

```ts
// api 成功後寫入;config 變更時清空(沿用既有 epoch/reset 慣例)。
const [apiResults, setApiResults] = React.useState<{
  byButtonId: Record<string, unknown>;   // 該按鈕最新成功回應
  last?: { buttonId: string; response: unknown };  // 全域最後一次
}>({ byButtonId: {} });
```

- 寫入點:`runAction` 的 api 成功分支(epoch guard 之後、`onAction` 之前)。
- 失敗不寫入 `apiResults`;失敗狀態由既有 `apiState`(status:'error')驅動 result 的錯誤顯示。

### result item 渲染(renderItem 新分支)

| 狀態 | 條件 | 顯示 |
|---|---|---|
| 空 | 尚無對應回應 | `emptyText`(resolveLabel,缺省 'No result yet') |
| loading | 綁定按鈕(或無綁定時任一 api 按鈕)`apiState.status === 'pending'` | 'Loading…' + spinner |
| 錯誤 | 對應按鈕最近一次 `apiState.status === 'error'` 且無成功回應可示 | 內建錯誤文案(含 meta 已有的 apiError 訊息不重複 —— 顯示 'Request failed') |
| 成功 | 有回應 | 依 mode 渲染(下) |

- **取值**:`sourceId` 有填 → `byButtonId[sourceId]`;沒填 → `last.response`。再套 `dataPath`(dot path helper 與 responseMap 共用 `getPath`);取不到(undefined)→ 視為空狀態,不炸。
- **card**:值為物件 → key-value 卡(key 左、值右;值非 scalar 時 `JSON.stringify` 單行截斷);值為陣列 → 逐筆 key-value 卡直式堆疊,`maxItems`(預設 10)截斷 + 「+N more」;值為 scalar → 單值卡。
- **json**:`<pre>` pretty print(`JSON.stringify(v, null, 2)`),樣式比照工具 JSON 面板(`bg-muted/30` 等既有慣例)。
- **table**:占位卡「Table view — pending table-builder」。
- 佈局:與其他 item 相同走 grid placement/fieldSpanStyle;無 conditional(型別不含,與 ButtonItem 一致)。

## 3. 工具(apps/web form-builder)

- **model.ts**:`Kind` 加 `"result"`;`Card` 加 `mode?/sourceId?/dataPath?/maxItems?/resultTable?(對映 table)/emptyText?`(命名避開既有欄位);cardToItem/formConfigToCards 雙向;新 result 卡預設 `{ mode: 'json' }`。
- **ui.tsx**:`KIND_META` 加 result 卡(icon `PanelBottom` 或類似、區別色);`PALETTE` 加 `"result"`。
- **inspector**:新 `inspector/result.tsx` —— mode select(card/json/table;table 選項標示 "coming soon" 但可選存)、source 下拉(列出畫布上現有 api 按鈕的 id+label,含「Last api response (unbound)」)、dataPath 輸入框、maxItems number(僅 card 顯示)、emptyText 輸入框。掛進 settings-panel(`isResult` gate)。
- **範例(sample.ts)**:加一顆 api 按鈕(`{ type: 'api', url: '/api/search', fields: [...] }`,打 preview 的 echo fetcher)+ 一個 result 區(`mode: 'card'`, `dataPath: 'received.data'`, 綁定該按鈕)—— preview 按查詢就看到 echo 內容渲染成卡片。placements 對齊現有 row 結構。
- inspector/palette 文案沿用硬編英文慣例;範例 label 用 LocalizedLabel(en+zh-TW)。

## 4. 測試策略

- **engine**:zod 各變體(合法:三種 mode、選填齊全;非法:mode 缺、maxItems 0/負數);`makeItem('result')`。
- **renderer**:空狀態 → 按綁定按鈕(mock fetcher)→ card 渲染物件;陣列 + maxItems 截斷 + '+N more';dataPath 取子節點;dataPath 取不到 → 空狀態;json 模式 pretty print;sourceId 綁定隔離(A 按鈕回應不進 B 的 result);無綁定顯示 last;錯誤狀態;loading 狀態;config 切換清空;table 模式占位卡。
- **工具**:model 雙向 round-trip;inspector 面板(mode 切換、source 下拉列 api 按鈕、maxItems 僅 card 顯示);ui.spec palette。
- **e2e 一條**:Preview → 按範例 api 按鈕 → result 卡出現 echo 內容。
- 真渲染:`next build` + `next start` 截圖 light/dark。

## 5. 慣例

- Changesets:`@rfjs/form-builder` minor、`@rfjs/form-builder-ui` minor(政策:有異動的 package 一律寫,private version-only)。
- Commit/PR 英文 conventional(subject 全小寫),`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;spec/plan 繁中;HOLD PR。
- e2e 撞 port 3002 時用 `E2E_PORT=3013`(table-builder session 用 3012)。
