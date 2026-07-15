# Form Designer — 進階輸入元件(Phase F1 + F1-rich)設計

**日期:** 2026-06-30
**狀態:** 已核可(實作前)— 經過一輪「5 視角對抗式檢視」並以實際程式碼驗證。
**負責範圍:** 表單工具(`@rfjs/form-builder` 引擎、`@rfjs/form-builder-ui`、`apps/web` 的 `form-designer` tool、`@rfjs/web-ui`)。

## 1. 目標

把 `form-designer`(2D 畫布表單建構器)與共用表單引擎推進到**接近 form-js 的元件廣度**,並加上兩個差異化的**進階輸入元件**(檔案上傳、手寫簽名)。表單維持 **rfjs 原生**(React、自有 design system、MIT 授權、自有 `@rfjs/data-filter` 條件引擎)—— 我們**不採用** bpmn-io 的 `form-js`。這個階段補的是**廣度**,不是介面(三欄 palette/畫布/inspector 你已經有了)。

這是兩條依序進行的軌道之一。另一條 —— `@rfjs/bpmn`(封裝 `bpmn-js` 的 BPMN 檢視器)—— 是**獨立的 spec**,排在這份之後。

## 2. 範圍

以**一份 spec、兩個嚴格依序的批次**交付:

### 批次 F1 — form-js 常見元件 + 欄位屬性
- **引擎新元件:** `CheckboxGroup`(多選 → `string[]`)、`TagList`(多選 → `string[]`)。
- **在畫布露出既有引擎元件:** `Radio`、`Checkbox`(這兩個引擎與 renderer **早就有了**,工作在畫布端 —— 見 §6)。
- **`FieldConfig` 新屬性:** `description`(`LocalizedLabel`)、`disabled`(`boolean`)、`readOnly`(`boolean`)。

### 批次 F1-rich — 差異化輸入元件
- **引擎新元件:** `FileUpload`、`Signature`。
- **renderer 上兩個注入式執行期接縫:** `uploadHandler`、`signatureTransport`。
- **兩個新的 `@rfjs/web-ui` 元件:** `<SignaturePad>`(包 `signature_pad`)、`<TagInput>`(用既有的 `command` + `popover` 組出來)。

### 不做 / 延後(擴充點在 §11 標明)
Group / Dynamic-list 容器、`fx` 動態運算式模型、Prefix/Suffix、Custom properties、Presentation 類型(Image/Table/HTML/Document)、iFrame、Action button、Expression 欄位。**法律級 / 憑證電子簽章(PKI)**明確屬於**獨立後端子系統**,不是表單元件。**ws/wss 遠端簽名擷取**是未來工作 —— 這階段只留好接縫(§9)。

## 3. 鎖定的架構決策

| 主題 | 決策 |
|---|---|
| 引擎真正新增的元件 | 只有 `CheckboxGroup`、`TagList`、`FileUpload`、`Signature`。`Checkbox`/`Radio` 已存在。 |
| 新屬性 | `description: LocalizedLabel`、`disabled: boolean`、`readOnly: boolean` 加進 `FieldConfig` + `fieldConfigSchema`(同一次改完)。 |
| 可插拔接縫(命名) | `fetcher`(既有)/ `uploadHandler` / `signatureTransport`。皆為 `ConfigForm`/`ConfigFormBuilder` 上的選填執行期 prop。**都不放進 `FormConfig`。** |
| 未注入時的語意 | `fetcher` + `uploadHandler` → 未設定就降級成 fallback。`signatureTransport` → 未設定時 fallback 到內建**可運作的本地** canvas 策略(可離線)。在 JSDoc 中說明。 |
| 值契約 | 見 §4。不新增 `dataType` enum 成員(否決 `file-ref`)。 |
| 簽名值 | 一個**圖片來源字串**:現在是 `data:` URL,未來遠端上傳時可為 `https:` URL。`dataType: 'string'` → `z.string()`。 |
| 簽名擷取 | `signatureTransport` **第一天就設計成非同步 + 可取消**(回傳 `SignatureCaptureHandle`)。本地手寫板實作同一介面。見 §9。 |
| TagList | **一個元件 + `creatable` 旗標。** `creatable=false` → options 必填,`z.array(z.enum)`。`creatable=true` → options 選填(當建議),`z.array(z.string())`。 |
| 畫布範圍 | **擴**到引擎完整的 `FieldComponent` union(含 `Date`、`Email`),讓「往返不失真」成立。 |
| FileUpload `maxSize` | 單位 = **bytes**(UI 顯示換算 MB)。超限 = **挑檔當下擋下**並給前端訊息。 |
| 批次 | F1 → F1-rich,嚴格依序。共用檔案的修改當**單一任務**(見 §10)。 |

## 4. 資料模型與值契約

`packages/form-builder/src/types.ts` 新增型別(re-export),對齊既有的 `DataSource*`:

```ts
export interface FileRef {
  name: string;
  size: number;      // bytes
  type: string;      // MIME
  url?: string;      // 由 uploadHandler 設定
  id?: string;       // 由 uploadHandler 設定
}

export type UploadHandler = (file: File, ctx?: { fieldKey: string }) => Promise<FileRef>;

export interface SignatureCaptureHandle {
  result: Promise<string>;            // resolve 成一個圖片來源字串
  cancel(): void;
  subscribe?(cb: (s: {
    status: 'idle' | 'pending' | 'ready' | 'error';
    sessionId?: string;
    error?: unknown;
  }) => void): () => void;            // 遠端 transport 用;本地省略
}

export type SignatureTransport = (ctx: {
  fieldKey: string;
  signal: AbortSignal;
}) => SignatureCaptureHandle;
```

`FieldConfig` 新增:

```ts
description?: LocalizedLabel;
disabled?: boolean;
readOnly?: boolean;
fileUpload?: { accept?: string; multiple?: boolean; maxSize?: number /* bytes */ };
```

元件 → `dataType` 對照(不新增 enum 成員):

| 元件 | dataType | required 語意 |
|---|---|---|
| `Checkbox`(單一) | `boolean` | `z.literal(true)`(同意條款:必須勾選) |
| `CheckboxGroup` | `array` | `z.array(...).min(1)` |
| `TagList` | `array` | `z.array(...).min(1)` |
| `FileUpload` 單檔 | `object` | 必須存在 |
| `FileUpload` 多檔 | `array` | `.min(1)` |
| `Signature` | `string` | `.min(1)`(非空 data URL) |

## 5. 引擎變更(`@rfjs/form-builder`)

1. `types.ts`:把 `CheckboxGroup`/`TagList`/`FileUpload`/`Signature` 加進 `FieldComponent`;加上新的 `FieldConfig` 屬性 + `FileRef`/`UploadHandler`/`SignatureTransport`/`SignatureCaptureHandle`。
2. `config-schema.ts`:
   - 四個元件加進元件 enum。
   - `fieldConfigSchema` 加入 `description`(`LocalizedLabel` = `union(string, record)`)、`disabled`、`readOnly`、`fileUpload` 子 schema。
   - `superRefine`:TagList 在 `creatable !== true` 時 `options` 必填。
   - 擴 `conditionSchema` 以**保留 `elementType`**(`z.string().optional()`)(若在範圍內也保留 elemmatch 的 `filters` key)—— `@rfjs/data-filter` 的 `StringArrayCondition` 需要它來分派到 `ArrayMatch`,而 zod v4 的 strip 目前會把它丟掉。只有在「array 型欄位能當條件來源」之後才會踩到,而這正是本階段首次開放的。
3. **`config-to-zod.ts`(地雷修正):**
   - 在 `options`-優先短路**之前**分支:`CheckboxGroup` 與非 creatable 的 `TagList` → `z.array(z.enum(values))`;creatable 的 `TagList` → `z.array(z.string())`。
   - `required` 包裝新增**array 分支**:array 值的元件 → `z.array(...).min(1, message)`。
   - 單一 `Checkbox` required → `z.literal(true)`。
   - `FileUpload` 值對 `FileRef`/`FileRef[]` 形狀驗證(或透過 `object`/`array` → `z.unknown()`,寬鬆、往返安全)。

## 6. form-designer(apps/web)變更

`apps/web/src/tools/form-designer/`(注意:#215 已從 `form-canvas` 改名 —— 檢視 agent 讀到的是改名前的樹,文中所有 `form-canvas` 路徑都對應到這裡):

1. `model.ts`:
   - 把 `DATATYPE`/`componentDataType` 從 `Record<Component, ScalarType>` 改成帶 `FieldType`(讓 `'array'`/`'object'` 能保留)。
   - 把 `Card.Component` + `CANVAS_COMPONENT_SET` 擴到引擎**完整的 `FieldComponent` union**(含 `Date`、`Email`,加上四個新元件)。**移除**正規化成 `Input` 的那行。
   - `cardToItem`/`formConfigToCards` 要把 `description`/`disabled`/`readOnly` + 新的 dataType 一併帶過去(別再複製固定的屬性清單)。
2. `inspector/settings-panel.tsx`:
   - Basics:加 `description`(i18n,透過 LabelsSection)、`disabled`、`readOnly`。
   - 把 `component === 'Select'` 的判斷改成集合成員判斷:`OPTIONS_COMPONENTS = {Select, Radio, CheckboxGroup, TagList}`(Options 編輯器)、`DATASOURCE_COMPONENTS = {Select, Radio, CheckboxGroup, TagList}`(Data Source 區塊)。
   - 加一個 **FileUpload** 區塊(`accept`/`multiple`/`maxSize`)與一個 **Signature** 區塊(可選筆色)。
   - 把 `description` 納入 i18n 的 `LabelsSection`,跟 `label` 並列。
3. `ui.tsx`:把新元件加進 palette 工具列;在預覽的 `<ConfigForm>`(約第 422 行)注入**mock `uploadHandler`**(並確認 `fetcher`/`sampleFetcher` 已接好)。`sampleFetcher` 已存在於 `tools/form-builder/sample.ts` 且為共用 —— 擴充它加上 mock uploader。

## 7. Renderer 變更(`@rfjs/form-builder-ui`)

1. `config-form.tsx` + `field-control.tsx`:
   - 渲染 `CheckboxGroup`(組合 `web-ui` 的 `checkbox`)、`TagList`(`<TagInput>`)、`FileUpload`(原生 input + `uploadHandler`)、`Signature`(透過 capture hook 的 `<SignaturePad>`)。
   - 處理 `description`(用 `resolveLabel` 渲染,放在 label 附近)、`disabled`、`readOnly`。
   - `readOnly` 依控件家族:原生 input/textarea → `readOnly` 屬性;radix 的 `Select`/`Checkbox`/`RadioGroup`/`Switch`/`DatePicker`(沒有 `readOnly` prop)→ 渲染成 `disabled` + `aria-readonly`。`disabled` → 各處用原生/radix 的 `disabled`。以**單一跨切面任務**橫跨 `FieldControl` switch 實作。
2. `ConfigForm` + `ConfigFormBuilderProps` 新增 prop:`uploadHandler?`、`signatureTransport?`;`ConfigFormBuilder` 把兩者轉發給它的預覽 `ConfigForm`。比照 `fetcher` 的 `useCallback` 記憶化 JSDoc。
3. 新增 hook `use-signature-capture.ts`(比照 `use-data-source.ts` 的 `active` 旗標拆除):持有 `idle|pending|ready|error`,unmount 時拆除,**在 `pending` 時鎖住送出按鈕**(讓未來的非同步/遠端擷取能繼承正確行為)。本地手寫板在筆畫結束時走同一套狀態機 resolve。

## 8. 新的 `@rfjs/web-ui` 元件

1. `<SignaturePad>` —— 薄薄包一層 **`signature_pad`**(szimek;約 10kb、MIT、零依賴)。宣告為 **dependency**(不是 dev —— web-ui 是 transpiled 原始碼)。在 `useEffect` 內實例化(僅 client、SSR 安全),resize 時做 `devicePixelRatio` 縮放,值透過 `toDataURL` 輸出,`clear()` 走 `pad.clear()`,支援受控/非受控。
2. `<TagInput>` —— 用既有的 `command`(`cmdk`,已是依賴)+ `popover` 組出來。options 當建議 + `creatable` 自由輸入。輸出 `string[]`。
3. `CheckboxGroup` 渲染組合既有的 `checkbox.tsx`(不需新 primitive)。
4. 在 `packages/web-ui/vitest.setup.ts` 加一個 `HTMLCanvasElement.getContext` stub(比照既有的 `ResizeObserver`/`scrollIntoView` stub)—— **在** `<SignaturePad>` 的 TDD **之前**,因為 jsdom 的 `getContext` 回傳 `null`,而 `signature_pad` 在 constructor 就會呼叫它。

## 9. ws/wss 未來相容(簽名接縫)

值契約固定(`一個圖片來源字串`),而**怎麼擷取**是可插拔策略:

- **現在:** `signatureTransport` fallback 到由 `<SignaturePad>` 支撐的內建本地策略。使用者畫完筆畫時 resolve `SignatureCaptureHandle.result`;省略 `subscribe`。
- **未來(ws/wss):** 遠端 transport(在手機/簽名板上簽、串回)實作**同一個** `SignatureTransport` 簽章。它用 `subscribe` 回報 `pending`/`ready`/重連狀態,並用暫態的 `sessionId`/配對 —— **全在 handle/ctx 上,絕不進 `FormConfig`**。`config-to-zod` 一律輸出 `z.string()`,所以本地→遠端的切換真正做到零 config 變更、非破壞性。
- 因為 handle 是非同步 + 可取消,且 renderer 第一天就在 `pending` 鎖送出,加遠端時不會有任何呼叫端的簽章改動。

## 10. 實作批次與平行化

- **F1 與 F1-rich 嚴格依序**(一份 spec、兩個批次)。
- 批次內,**共用檔案的修改**(`types.ts` union、`config-schema` enum、`field-control` switch、`model.ts` maps、`settings-panel` COMPONENTS、`ui.tsx` palette/gating)當**單一原子任務** —— 不要一個元件一個 subagent(每個元件都改同樣那 ~6 個檔案/行,逐元件平行會處處衝突)。
- 只平行**真正不相干**的工作:獨立的 `<SignaturePad>` + `<TagInput>` web-ui 元件與其測試 vs. 不相干的引擎 zod 測試。
- 走 **subagent-driven TDD** + 逐任務 review(既有流程)。fresh worktree 中,引擎要先 build 出 dist 再跑 UI 測試。

## 11. 延後項 —— 標明擴充點(現在零程式碼)

- **Group / Dynamic-list** = 唯一的結構性斷崖。把接縫命名好,讓 F1 不會硬寫死:未來 `FormItem` 的 discriminated-union `'group'`/`'dynamiclist'` kind;`configToZod` 平面的 `z.object` 值契約;平面的 `Card` `groupId`+`col/span/row` 模型。F1 **不會**把它堵死(`string[]` 放在平面 key)。
- **`fx` / 動態屬性引擎** = 未來的 `@rfjs/data-expr`(已自有、dataSource 已在用)。`disabled`/`readOnly` 現在以純 boolean 出貨,保留可加性的遷移路徑(`boolean | { expr }`)。
- **Prefix/Suffix、Custom properties、Presentation 類型、iFrame、Action button** = 之後便宜可加。**Expression 欄位**綁在 `fx` 決策上。

## 12. 測試策略

- **引擎 zod(TDD,先寫失敗測試):** 有 options 的 CheckboxGroup 驗證成 `string[]` 而非 `string`;required 的 CheckboxGroup/TagList 拒絕 `[]`;creatable TagList 接受任意字串;required 單一 Checkbox 拒絕 `false`;條件引用 `string[]` 欄位時,`elementType` 在 parse→serialize→parse 後保留;既有條件樹仍能往返。
- **引擎往返:** 新元件/屬性能通過 `parseFormConfig`(zod v4 會 strip 未指定的 key —— 新增項必須在 schema 內)。
- **Renderer:** 每個新元件能渲染;FileUpload 在**沒有** `uploadHandler` 時顯示優雅 fallback;`readOnly` 顯示值但拒絕編輯且帶 `aria-readonly`。
- **form-designer:** `FormConfig → cards → FormConfig` 往返,斷言新屬性與 array/object dataType 能存活,且 Date/Email 不再被正規化成 Input。
- **web-ui:** `<SignaturePad>` 生命週期(mount/clear/toDataURL/受控-非受控)配 `getContext` stub;`<TagInput>` 建議 + creatable。
- **瀏覽器檢查:** 用 Playwright/headless 截圖 form-designer 預覽,確認真實的簽名擷取 + 選檔。

## 13. 風險與緩解

| 嚴重度 | 風險 | 緩解 |
|---|---|---|
| High | `config-to-zod` 只修一半(base 改對但漏了 `required .min(1)` / array 分支)→ required 多選會默默通過空值。 | TDD 先寫四個 required/array 的失敗測試;把 `config-to-zod` 當第一級 spec 工作。 |
| Medium | `readOnly` 在 radix 控件上沒有一級語意;disabled-fallback 可能讓填表者困惑;switch 改動面廣。 | 在 spec 定義各控件家族行為;以單一跨切面任務實作;加「顯示值 + 拒絕編輯 + `aria-readonly`」的測試/截圖檢查。 |
| Medium | `signature_pad` 為兩個 app 增加執行期重量;jsdom 無法跑真實繪圖。 | 宣告為 web-ui dependency(~10kb);用 stub 測 wrapper 生命週期;以瀏覽器截圖驗證真實擷取。 |
| Medium | 畫布 union 擴充(含 Date/Email)+ `FieldType` 改動同時動到 model/settings/palette/mappers。 | 做成單一原子任務 + 往返測試。 |
| Medium | 非同步簽名在送出後才 resolve → 未來遠端繼承壞行為。 | 現在就把 `pending` 狀態做進 `use-signature-capture` 並鎖送出。 |
| Low | `conditionSchema` 改動可能過嚴,拒絕到有效的樹。 | 保持寬鬆(選填 `elementType`、保留 passthrough/union);加既有條件樹的向後相容往返測試。 |

## 14. 開放問題 —— 已解決

1. 畫布範圍 → **現在就擴**(含 Date/Email)。
2. FileUpload `maxSize` → **bytes**(顯示 MB)+ **挑檔當下擋下**並給前端訊息。
