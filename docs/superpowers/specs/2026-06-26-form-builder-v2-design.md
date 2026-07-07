# Form Builder v2 — 設計規格

**日期：** 2026-06-26
**狀態：** 草稿（待審查）
**分支：** `worktree-feat-form-builder-v2`

## 1. 摘要

把已上線的 ConfigFormBuilder（v1：P1–P3c/P4）升級為 v2 —— 從「欄位清單」進化為**項目(item)化、可分組編排**的視覺表單建構器：item 有多種 kind（輸入欄位 / 內容 / 版面 / AI 備註），支援 **section + 列式編排器**、**驗證**、**條件顯示**、**多語 label**、**外部 API 取值**，UI 一律用 **shadcn** 元件。目標是把現況「功能可用但外觀/互動/功能不夠」的 builder 做到精緻、好用、夠力。

mockup（已對齊，本機）：`form-builder-v2-mockup.html`、`form-builder-layout-options.html`。

## 2. 背景

v1 已交付並合併（PR #191/194/195/196/197/198）：`@rfjs/form-builder` 引擎（types/schema/configToZod/list-ops/LocalizedLabel）+ `@rfjs/form-builder-ui`（`<ConfigForm>`、`<ConfigFormBuilder>`、`FieldRow`）+ `apps/web` 的 `form-builder` 工具。使用者回饋：**外觀不夠好、互動不順、功能不足**（方向 OK）。v2 即針對這三面改善並擴充。

## 3. 核心模型升級：item 有 kind

表單從 `fields[]` 升級為 **`items[]`**，每個 item 有 `kind`：

- **`field`（輸入）**：收資料。`component`（Input/Textarea/Select/Checkbox/Date/Number/Radio/Switch/Email…）、`dataType`、`width`、`label`(LocalizedLabel)、`required`、`options`、`validation`、`conditional`、`aiNote`、`dataSource`。
- **`content`（內容）**：固定文字/說明（markdown）。`text`(LocalizedLabel-like)、`locked`（preset 不可編輯）、`conditional`、`dataSource`（可顯示外部取值）。無資料。
- **`divider` / `spacer`（版面）**：分隔線 / 空白（`spacer.size`）。無資料。
- **`ai-note`（AI 備註）**：`text`（給 AI 的 prompt/說明）。**不渲染給填表者**，只存在 config 供 AI/匯出使用。

巢狀結構：**section → rows → items**（列式編排器，見 §6）。`configToZod` **只對 `field` item 產資料驗證**；其餘 kind 不產資料。`conditional` 同時適用 `field` 與 `content`。向後相容：v1 的扁平 `fields[]` 視為「單一隱性 section、每欄一列、kind=field」。

## 4. 功能設計（逐項）

### 4.1 驗證規則（v2-B）
`FieldConfig.validation`：`{ min?, max?, minLength?, maxLength?, pattern?, message? }`。`configToZod` 依此產出 zod（數值 min/max、字串 length/regex、自訂 message）。builder 屬性編輯器加 Validation sub-block；渲染端顯示錯誤訊息。

### 4.2 條件顯示（v2-C）
`item.conditional`：一個 **`@rfjs/data-filter` 的 filter tree**（重用既有引擎）。`<ConfigForm>` 在執行期對「目前表單值物件」評估該 tree → show/hide 該 item。builder 用條件編輯器（可重用 filter-builder-ui 概念）。適用 field 與 content。

### 4.3 多語 label（v1 已具，v2 強化）
`label` / content `text` 為 `LocalizedLabel`；builder 依 `locales` 顯示逐語言輸入；`resolveLabel` 渲染。

### 4.4 內容 / 版面 / AI 備註區塊（v2-F）
- `content`：markdown 文字、`locked`（preset）、可條件顯示、可掛 `dataSource` 顯示外部值。
- `divider` / `spacer`：純版面。
- `ai-note`：AI-only block；**且每個 `field` 可附 `aiNote`**（per-field AI 說明）。皆不渲染給填表者；config/匯出可見。

### 4.5 shadcn UI（v2-A 起，全程）
builder 控制元件（型別/寬度/必填…）一律用 **shadcn `Select`/`Checkbox`** 等，**不用原生 HTML 控制元件**。（「原生/shadcn 可選」為 nice-to-have，預設 shadcn。）radix Select 在 jsdom 較難測 → 測 handler 邏輯為主。

### 4.6 shadcn 日期選擇器（v2-E）
`Date` 欄位升級為 **shadcn DatePicker**（需先補 `@rfjs/web-ui` 的 `Calendar`，用 `react-day-picker` + 既有 `Popover`）。

### 4.7 更多輸入型別（v2-E）
Number / Radio / Switch / Email …（部分需先補 web-ui `Switch`、`RadioGroup`、`Calendar`）。

### 4.8 外部 API 取值 / 資料來源（v2-G）
`item.dataSource`：
```
{ request: { url, method, headers?, body? },
  extract: { dialect: 'path' | 'jsonpath' | 'jsonata', expr },
  fallback: '無' }
```
- 用途：(a) 動態 Select/Radio **選項**（撈清單 → map {label,value}，label 可用 `@rfjs/data-label`）；(b) `content` **顯示值**（唯讀）；(可選) 欄位**預設值**。
- 取值**可插拔**：`path`→`@rfjs/object-utils`、`jsonpath`→jsonpath lib、`jsonata`→`@rfjs/data-expr`。
- **執行期 fetch**：runtime 取資料，需 loading / empty / error 狀態 + `fallback`（取不到顯示「無」）。
- **可插拔 fetcher**：實際 fetch 由 consumer 注入（散佈成 shadcn registry 元件時，auth/CORS/安全由使用者掌控，元件不寫死網路行為）。

## 5. 外觀 / 互動打磨（v2-A）
- 載入時帶**種子範例**（不空白）；真空時顯示**空狀態引導**。
- 編輯區**框架化**（面板）、欄位卡打磨（摘要 pill）。
- **修預覽 remount 閃爍**：現況 `<ConfigForm key={JSON.stringify(config)}>` 每次改動都 remount → 改成 ConfigForm 對 config 反應式（或穩定 keying）。
- 修「空預覽裡孤兒 Submit」；Submit 配色/位置調整。
- builder 控制改 shadcn（§4.5）。

## 6. 版面：列式編排器（v2-D；2D 畫布為未來 v2-?）
**section → rows → items**：拖一個 item 到另一個旁邊 → 同列並排；拖到列間插入線 → 新列；`@dnd-kit` 多容器 sortable。RWD 時每列疊單欄。每段可設 columns（影響列內均分）。**自由 2D 畫布**（座標式、跨欄跨列、resize）威力最大但對表單過頭，列為**未來加強**，疊在列式編排器之上。

## 7. 套件落點
- `@rfjs/form-builder`（引擎）：item/section/rows 型別、schema、`configToZod`（驗證）、conditional 評估（包 data-filter）、dataSource 取值（resolver，包 object-utils/data-expr/data-label）、list/tree-ops。
- `@rfjs/form-builder-ui`：`<ConfigForm>`（渲染：sections/rows/conditional/dataSource/validation/更多型別/shadcn）、`<ConfigFormBuilder>`（編輯：列式編排器、item 屬性編輯、各 sub-block）。
- `@rfjs/web-ui`：補 `Calendar`、`Switch`、`RadioGroup` 等 shadcn 元件。
- `apps/web`：`form-builder` 工具（已存在）改帶種子 config + locales。

## 8. 分階段（各一個 PR；TDD + 逐任務審查）
| 階段 | 內容 |
|---|---|
| **v2-A** | 外觀/互動打磨 + 控制元件改 shadcn（種子/空狀態、框架化、修預覽閃爍、Submit、shadcn Select 取代原生） |
| **v2-B** | 驗證規則（schema/configToZod + 編輯器 + 渲染訊息） |
| **v2-C** | 條件顯示（重用 data-filter；field + content） |
| **v2-D** | section + 列式編排器（item-kind 模型 + 巢狀 + @dnd-kit 多容器） |
| **v2-E** | 更多輸入型別 + shadcn DatePicker（補 web-ui Calendar/Switch/Radio） |
| **v2-F** | 內容/分隔線/空白/AI-note 區塊 + 每欄 AI 說明 |
| **v2-G** | 外部 API 取值 / dataSource（可插拔 fetcher + 取值 dialect） |
| *(future)* | 自由 2D 畫布；registry 散佈（A，原始目標，獨立計畫） |

各階段向後相容、可獨立 merge；模型擴充（items/section/rows）會在最早需要它的階段引入（v2-D 引入巢狀；v2-F 引入非 field kind；驗證/條件為 field 欄位擴充，可早於巢狀）。

## 9. 非目標 / 取捨
- 自由 2D 畫布 —— 未來再說（列式編排器先）。
- registry 散佈 —— 獨立計畫。
- dataSource 不在元件內寫死網路/auth —— 用注入 fetcher。
- 「原生/shadcn 可選」開關 —— 預設 shadcn，開關列為 nice-to-have。

## 10. 開放決策（實作時定奪）
1. dataSource 取值 dialect 預設：建議 `path`（object-utils）為預設、`jsonata`（data-expr）為進階；`jsonpath` 視需要。
2. section 巢狀引入時機：v2-D；在那之前 v2-B/C 以扁平 field 擴充進行（向後相容）。
3. 條件編輯器 UI：重用 `@rfjs/filter-builder-ui` 概念或做精簡版（v2-C 定）。
