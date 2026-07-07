# form-builder ② 動作/按鈕模型 — 設計規格

日期:2026-07-07
分支:`feat-form-actions`(獨立 worktree,基於 `origin/main` @ `fcfdc88`)
狀態:設計已與使用者逐點確認(v1 動作全包含 api;按鈕 = item kind A 案;api 回應寫回欄位;metadata 全配置;驗證每顆可設)

## 目標

form-builder 系列(engine `@rfjs/form-builder` → renderer `@rfjs/form-builder-ui` → 工具 `apps/web/src/tools/form-builder`)新增**可配置按鈕**:

1. **按鈕成為畫布 item**(新 `ItemKind: 'button'`):可拖放位置、可多顆、可與欄位同列。
2. **五種動作**:`submit` / `reset` / `clear`(指定欄位)/ `custom`(命名事件)/ `api`(送值到 URL,回應可寫回欄位)。
3. **統一 payload 信封**:所有帶資料的動作送 `{ data, meta }`;meta 含自動鍵 + 配置靜態鍵 + 執行期注入。
4. **驗證語義**:每顆按鈕 `validate?: boolean`(submit 預設驗、api/custom 預設不驗、reset/clear 不適用)。
5. **Builder 支援**:palette 按鈕卡 + inspector 依動作型別的配置面板 + SubmissionPanel 顯示動作 payload + 範例示範。

## 非目標(v1 明確不做)

- 不做 footer/actions 專屬區(B 案)—— 按鈕只以 item 形式存在;無按鈕時的預設 Submit 提供等效便利。
- api 動作不內建 http client —— 一律走既有注入式 `fetcher`(`DataSourceFetcher`);無 fetcher 時 api 按鈕 disabled 並顯示提示。
- 不做按鈕級權限/條件顯示(可用既有 item 條件顯示機制,如已存在;不另加)。
- 不動 workbench、不動其他工具。

## 相容性決策

- `FormConfig` 新增欄位全部**選填**(`id?`、`meta?`、button item);舊 config 零遷移。
- **表單中沒有任何 `button` item → ConfigForm 照現行為渲染預設 Submit 按鈕**(`submitLabel` prop 續用),完全向下相容。
- **Breaking(已接受)**:`ConfigForm` 的 `onSubmit` 簽名由 `(values) => void` 改為 `({ data, meta }) => void`。影響面 = apps/web 自己(form-builder 系列為 private workspace package,不發布);apps/web 內所有呼叫端同 PR 修正。

## 1. Engine schema(`packages/form-builder/src/types.ts` + zod schema)

```ts
export type ButtonActionType = 'submit' | 'reset' | 'clear' | 'custom' | 'api';

export type ButtonAction =
  | { type: 'submit' }
  | { type: 'reset' }
  | { type: 'clear'; fields: string[] }                 // 要清空的 field keys(至少 1)
  | { type: 'custom'; name: string }                    // 宿主事件名(至少 1 字元)
  | {
      type: 'api';
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';  // 預設 POST
      fields?: string[];                                 // 送出的 field keys;缺省 = 全部可見欄位
      responseMap?: Record<string, string>;              // { "response 內取值路徑(dot path)": "目標 field key" }
      messages?: { success?: LocalizedLabel; error?: LocalizedLabel };  // 缺省用內建文案
    };

export interface ButtonItem {
  kind: 'button';
  label: LocalizedLabel;
  action: ButtonAction;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';  // 預設 primary(submit)/outline(其他)
  validate?: boolean;  // 缺省:action.type === 'submit' → true,api/custom → false;reset/clear 忽略此欄
}
```

- `ItemKind` 聯集加 `'button'`;`FormItem` 聯集加 `ButtonItem`;zod schema(`schema.ts`)同步以 discriminated union 驗證 `action`。
- `FormConfig` 頂層新增:`id?: string`(→ `meta.formId`)、`meta?: Record<string, unknown>`(→ `meta.custom`)。
- `config-to-zod` 不受影響(button 不是資料欄位,不進 zod 物件)。

## 2. Payload 信封(`SubmissionMeta` 擴充,`form-builder-ui`)

既有 `SubmissionMeta`(valid/errors/visibleKeys/schemaVersion)**擴充**:

```ts
export interface ActionMeta extends SubmissionMeta {
  formId?: string;                       // config.id
  timestamp: string;                     // ISO,動作觸發當下
  action: { type: ButtonActionType; name?: string };  // name 僅 custom
  custom?: Record<string, unknown>;      // config.meta 原樣
  [key: string]: unknown;                // metaProvider 展開的動態鍵
}
```

- 適用動作:`submit` / `custom` / `api` 的 payload 一律為 `{ data, meta: ActionMeta }`;`data` 沿用 `computePayload`(可見欄位)。
- `metaProvider?: () => Record<string, unknown>` 為 ConfigForm 新 prop,執行期動態值(user、session…),展開合併進 meta(自動鍵優先,metaProvider 不得覆蓋 timestamp/action 等保留鍵)。
- 預設 Submit(無 button item 的相容路徑)也走同一信封:`action: { type: 'submit' }`。
- `onPayloadChange` 維持現行為與型別(live seam,不含 action)—— 不改,避免雙重 breaking。

## 3. Renderer 行為(`packages/form-builder-ui/src/config-form.tsx`)

新 props:

```ts
onSubmit: (payload: { data: Record<string, unknown>; meta: ActionMeta }) => void;   // 簽名變更
onAction?: (name: string, payload: { data; meta: ActionMeta; response?: unknown }) => void;
metaProvider?: () => Record<string, unknown>;
```

動作執行規則:

| 動作 | 驗證(validate 生效時) | 行為 |
|---|---|---|
| `submit` | 預設驗 | RHF handleSubmit → `onSubmit({ data, meta })` |
| `reset` | 不驗 | `form.reset(defaultValues)` |
| `clear` | 不驗 | 指定 keys 逐一 `setValue`(文字類 `""`、其餘 `undefined`),`shouldDirty: true` |
| `custom` | 預設不驗 | `onAction(action.name, { data, meta })` |
| `api` | 預設不驗 | 見下 |

- **驗證失敗** → RHF 顯示欄位錯誤,動作不發(與現行 submit 行為一致)。
- **api 流程**:
  1. 取值:`fields` 有列 → 只取列出的 keys(仍限可見欄位);缺省 → 全部可見欄位。
  2. 經 `fetcher` 送出:複用 `DataSourceFetcher` 介面,request 帶 `{ url, method, body: { data, meta } }`(GET 時 data 掛 query 由宿主 fetcher 自行處理 —— 我們只傳結構,不拼 URL)。
  3. 按鈕 pending:disabled + spinner(lucide `Loader2`);同表單同時只允許一顆 api 按鈕 in-flight。
  4. 成功:按鈕旁顯示 `messages.success`(預設文案);`responseMap` 逐項以 dot path 取回應值 → `setValue` 到目標 field key(路徑取不到 → 跳過該項,不報錯);`onAction?.('api', { data, meta, response })`。
  5. 失敗(fetcher throw / reject):按鈕旁顯示 `messages.error`(預設文案);**不另設失敗 callback** —— 統一走 `onAction('api', { data, meta, response: undefined })`,並在 meta 加 `apiError: string`(錯誤訊息)。
  6. 無 `fetcher` prop:api 按鈕 render 成 disabled + title 提示(不 throw)。
- **無任何 button item** → 尾端渲染預設 Submit(現行為),onSubmit 走新信封。

## 4. Builder 工具(`apps/web/src/tools/form-builder/`)

- `model.ts`:`Kind` 加 `"button"`;`KIND_META` 加按鈕卡(icon `MousePointerClick` 或類似,預設 span 3);cards↔FormConfig 對映攜帶 `button` 資料。
- palette 加「按鈕」;新按鈕預設 `{ label: "Button", action: { type: "custom", name: "action-1" } }`。
- inspector 新面板(依 `action.type` 切換):
  - 共通:label(i18n 欄)、variant select、validate switch(reset/clear 時隱藏)。
  - type select:submit/reset/clear/custom/api。
  - clear:multi-select 現有 field keys;custom:name 輸入框;api:url、method select、fields multi-select、responseMap key-value 列表編輯、success/error 訊息文字。
- Preview 分頁 `SubmissionPanel`:顯示最後一次動作的完整 `{ data, meta }`(含 `meta.action` 標示哪顆按鈕);api 在 preview 用內建 echo fetcher(回傳收到的 body,加 `{ echoedAt }`)讓 responseMap 可示範。
- `SAMPLE_CONFIG` 加示範:主送出(submit)+ 存草稿(custom "save-draft")+ 搜尋列 inline 清除(clear)。
- i18n:tool messages 加 palette/inspector 新鍵(en + zh-TW);engine 內建訊息(api 成功/失敗預設文案)走 LocalizedLabel 預設值。

## 5. 測試策略

- **engine**(`packages/form-builder`):zod schema 各 action 變體(合法/非法:clear 空 fields、custom 空 name、api 缺 url);ButtonItem 預設值語義。
- **renderer**(`packages/form-builder-ui`):
  - 無 button item → 預設 Submit + 新信封格式(formId/timestamp/action/custom/metaProvider 合併與保留鍵保護)。
  - 各動作:submit 驗證擋下/通過、reset 回預設、clear 只清指定欄、custom 呼叫 onAction、validate=true 的 api 驗證擋下。
  - api:mock fetcher —— 成功訊息 + responseMap 寫回(含 dot path 取不到跳過)、失敗訊息 + meta.apiError、pending disabled、無 fetcher 時 disabled。
- **工具**(apps/web):palette 加按鈕卡、inspector 面板切換、SubmissionPanel 顯示 meta.action、範例含三顆按鈕。
- **e2e**:一條 —— 進 form-builder Preview → 按 custom 按鈕 → submission panel 出現 `"action"` 與按鈕名。
- 真渲染:`next build` + `next start` 截圖(light/dark)驗 palette/inspector/preview。

## 6. 慣例

- 獨立 worktree `feat-form-actions`;commit/PR 英文 conventional(subject 全小寫),結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- form-builder 系列為 private package → **無 changeset**。
- PR 開好後 HOLD,使用者自行 merge。
