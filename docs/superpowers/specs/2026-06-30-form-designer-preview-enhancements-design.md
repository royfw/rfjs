# Form Designer — Preview 強化設計

**日期:** 2026-06-30
**狀態:** 已核可(實作前)— 經 brainstorming 收斂、mockup 驗證。
**前置:** 建立在 #216(form rich inputs,已 merge 到 `main` `42b26e6`)之上。
**負責範圍:** `@rfjs/form-builder`(引擎 schema)、`@rfjs/form-builder-ui`(ConfigForm renderer + 新 hook)、`apps/web` 的 `form-designer` tool。

## 1. 目標與背景

form-designer 主打 **2D 版面**,但目前產出的表單在窄寬**不會 reflow**:`ConfigForm` 的外層 grid 用 `md:` **視窗** media query 塌縮(`config-form.tsx:243`),而 section / grid-mode 內層 grid 是**寫死的 inline `gridTemplateColumns`**(`config-form.tsx:265,286`),完全不塌。因此「把預覽容器縮窄」看不到真實手機版面,且實際部署的表單在手機上會爆版。

本功能解決兩件事:
- **R(真正的響應式)**:讓 `ConfigForm` 依**容器寬**塌縮(連帶讓 form-builder 線性表單也受益)。
- **P(預覽檢視器)**:Preview 頁籤的裝置/手動寬度預覽、Canvas 頁的可收合即時預覽、以及**即時送出資料(Submission)面板**。

**②「可配置按鈕/動作模型」(送 API、reset/clear、可自訂 metadata 信封)不在本 spec** —— 它是 rich-inputs spec §11 延後的「Action button」,獨立成下一個 feature。本 spec 的 Submission 面板只顯示引擎內建的 payload + 基本 metadata,並預留 seam 供 ② 接入。

## 2. 範圍

- **R**:`ConfigForm` 改用 ResizeObserver 量容器寬、依可配置門檻 `stackBelow`(預設 640)塌縮。
- **P-1**:共用元件 `<ResponsivePreview>`(裝置預設 + 手動寬度 + 拖曳把手)。
- **P-2**:Preview 頁籤用完整版 `<ResponsivePreview>`;Canvas 頁改成**兩個獨立可收合區塊**(Editor[grid+inspector] / Live Preview)。
- **P-3(①)**:即時 **Submission 面板**(watch 驅動,不需按 Submit),呈現 `{ data, meta }`。

### 不做 / 延後(擴充點見 §10)
② 動作/按鈕模型與可自訂 metadata 信封;per-section 門檻覆寫;多階斷點。

## 3. 鎖定決策

| 主題 | 決策 |
|---|---|
| reflow 機制 | **ResizeObserver 量容器寬**(非純 CSS `@container`)→ 門檻可配置 |
| 門檻 | `FormConfig.responsive.stackBelow`,**預設 640**,可每表單覆寫 |
| 塌縮規則 | 容器寬 < `stackBelow` → 全部單欄;grid-mode(絕對定位)依 (row, colStart) 順序堆疊;flow grid / v1 → 單欄 |
| form-builder 線性表單 | **一併變容器響應式**(同一個 ConfigForm 改動;加 v1 回歸) |
| Submission 面板 | **即時**(watch),非 Submit 觸發;呈現 `data` + 內建 `meta`;面板在響應式框**外** |
| metadata | 本 spec = 引擎內建(valid/errors/visibleKeys/schemaVersion);可自訂信封 = ② |
| Canvas 版面 | 兩個獨立 Collapsible:Editor[grid+inspector] / Live Preview;預設 Editor 開、Preview 收 |
| Submit 按鈕 | 保留(互動真實感),但 payload 顯示不靠它 |

## 4. R — 容器響應式(`@rfjs/form-builder-ui`)

### 新 hook:`use-container-breakpoint.ts`
```ts
// 量 ref 元素的 inline-size,回傳是否窄於門檻;ResizeObserver 驅動,SSR 安全
// (未量到前回 false → 預設寬版)。只在跨越門檻時才更新 state(避免每像素 re-render)。
export function useContainerBreakpoint(ref: React.RefObject<HTMLElement>, breakpoint: number): boolean;
```
- 用既有的 ResizeObserver(form-builder-ui 的 `vitest.setup.ts` 已有 stub,#216 加的);無 `window`/SSR 時回 `false`。

### `config-form.tsx` 改動
- 在表單根 `<form>` 掛 `ref`;`const narrow = useContainerBreakpoint(rootRef, stackBelow)`,其中 `stackBelow = config.responsive?.stackBelow ?? 640`。
- **外層 grid**(目前 `className="grid grid-cols-1 ... md:[grid-template-columns:repeat(var(--form-cols)...]"`,line 243):移除 `md:` 視窗變體,改成依 `narrow` 決定 `gridTemplateColumns`(narrow → `1fr`,否則 `repeat(var(--form-cols)…)`,以 inline style 設定)。
- **grid-mode section grid**(line 265)與 **flow section grid**(line 286):narrow → `gridTemplateColumns: '1fr'`,且各 item 不套用 placement 的 `gridColumn`(改 `1 / -1`)。
- **堆疊順序**:單欄時 DOM 順序即視覺順序。確保 grid-mode 的 items 以 **(row, colStart)** 排序輸出(若目前非此序,於 narrow 時 render 前排序;或在 `formConfigToCards`/`cardsToFormConfig` 端保證序)。
- 影響:form-builder 線性表單(v1 `fields[]`、flow sections)一併走容器塌縮 → 需 v1 視覺回歸。

### 引擎 schema(`@rfjs/form-builder`)
- `types.ts`:`FormConfig` 加 `responsive?: { stackBelow?: number }`。
- `config-schema.ts`:`responsive: z.object({ stackBelow: z.number().positive().optional() }).optional()`(additive,strip-safe,round-trip)。

## 5. P — ResponsivePreview 檢視器 + Canvas 版面(`apps/web` form-designer)

### `responsive-preview.tsx`(新)
```ts
export interface ResponsivePreviewProps {
  children: React.ReactNode;          // 內含 <ConfigForm>
  width: number; onWidthChange: (w: number) => void;
  min?: number; max?: number;         // 預設 320 / 1280
  compact?: boolean;                  // Canvas 內嵌精簡模式
}
```
- 渲染:裝置預設分段鈕(手機 375 / 平板 768 / 桌機=max)、寬度 range + 數字輸入(夾值)、置中的框 `style={{ width }}`、框右緣可拖曳把手、寬度標籤。
- 框把 `children` 包在 `width` 受限的容器裡 → `ConfigForm` 的 ResizeObserver 量到較小容器 → 依 `stackBelow` 塌縮(**不需 iframe**)。

### Preview 頁籤(`ui.tsx`,目前 line 457-459)
- 換成 `<ResponsivePreview>` 完整版,內含 `<ConfigForm … onPayloadChange={setPayload}>`,旁/下放 **Submission 面板**(§6)。

### Canvas 頁(`ui.tsx`,目前 line 347-455)
- 外層改成**兩個獨立 Collapsible 區塊**(用 `@rfjs/web-ui` 既有 collapsible/disclosure,或既有的 section 收合樣式):
  1. **Editor**:展開時維持現有 grid(左)+ `aside` inspector(`lg:w-[420px]`,line 424)並排;收合時只剩標題列(inspector 跟著收)。
  2. **Live Preview**:`<ResponsivePreview compact>` + Submission 面板(精簡);預設**收合**。
- 兩者獨立收合(非手風琴)。預設:Editor 開、Live Preview 收。

## 6. ① 即時 Submission 面板

### ConfigForm seam
- 把目前 submit handler(`config-form.tsx:233-241`)裡建 `out`(payload + conditional 過濾)的邏輯抽成純函式 `computePayload(values, config) → Record<string, unknown>`,供 `onSubmit` 與即時檢視共用。
- 新增選填 prop `onPayloadChange?(p: { data: Record<string, unknown>; meta: SubmissionMeta }): void`;以 RHF `watch()` 訂閱值變動(rAF/debounce),每次算出 `data = computePayload(values, config)` 與 `meta`,呼叫 `onPayloadChange`。
```ts
export interface SubmissionMeta {
  valid: boolean;                       // zod safeParse 結果
  errors: Record<string, string>;       // key → 第一個錯誤訊息
  visibleKeys: string[];                // 目前可見(未被 conditional 隱藏)欄位
  schemaVersion?: number;               // config.version
}
```

### 面板(form-designer)
- 在 `<ResponsivePreview>` **框外**渲染一個可收合面板,即時顯示 `meta` + `data`(格式化 JSON;失敗時 `meta.valid=false` + errors)。Preview 頁籤=並排/下方;Canvas Live Preview=精簡(可收合)。
- 因為在框外,所以不會被當表單內容一起塌縮。

## 7. 資料 / 型別契約

- `FormConfig.responsive?: { stackBelow?: number }`(預設 640)。
- `ConfigForm` 新 prop `onPayloadChange?`;`ConfigFormBuilder` 比照 `fetcher` 轉發(讓 form-builder 也能用)。
- `SubmissionMeta`(見上)。② 之後**擴充** `meta`(加 formId/timestamp/自訂信封)與 action 結果,沿用同一個 `onPayloadChange` seam。

## 8. 檔案 / 元件

- 新:`packages/form-builder-ui/src/use-container-breakpoint.ts`(+ spec)。
- 改:`packages/form-builder-ui/src/config-form.tsx`(ref + narrow 塌縮、`computePayload` 抽取、`onPayloadChange` + watch);`config-form-builder.tsx`(轉發 `onPayloadChange`)。
- 改:`packages/form-builder/src/types.ts` + `config-schema.ts`(`responsive` 欄位)。
- 新:`apps/web/src/tools/form-designer/responsive-preview.tsx`、`submission-panel.tsx`(或合一)(+ spec)。
- 改:`apps/web/src/tools/form-designer/ui.tsx`(Preview 頁籤用 ResponsivePreview + Submission;Canvas 頁兩段式 Collapsible)。

## 9. 測試策略

- `useContainerBreakpoint`:mock ResizeObserver,斷言跨 `stackBelow` 時 boolean 翻轉、SSR/未量到回 false。
- `ResponsivePreview`:preset 設寬、range/數字輸入更新、拖曳更新、min/max 夾值。
- `onPayloadChange`:render 表單 → 改值(fireEvent)→ 斷言 callback 收到更新的 `data`;隱藏 conditional 欄位 → 斷言該 key 不在 `data`/`visibleKeys`;非法值 → `meta.valid=false` + errors。
- `computePayload`:純函式單元測試(conditional 過濾、dataType 形狀)。
- reflow:jsdom 驗不了版面 → **結構斷言**(narrow 時 grid style = `1fr`、placement gridColumn 收為 `1/-1`)+ **headless 截圖** 375/768/1280。
- form-builder v1 回歸:既有測試 + 寬版仍多欄、`md:`→容器驅動沒破壞線性表單。

## 10. 延後 — 擴充點(本 spec 零程式碼)

- **② 動作/按鈕模型**:`onPayloadChange` 的 `meta` 預留擴充;action 結果與可自訂 metadata 信封走同一 seam。
- **per-section 門檻覆寫** / **多階斷點**:`responsive` 目前只放 form-level `stackBelow`;日後可加 `section.responsive` 或斷點陣列。

## 11. 風險與緩解

| 嚴重度 | 風險 | 緩解 |
|---|---|---|
| Medium | 從 `md:` 視窗 CSS 改成 JS(ResizeObserver)驅動 → SSR/無 JS 時恆為寬版(行為變更) | 這幾個 app 皆 client-side;文件註明;寬版為安全預設 |
| Medium | ResizeObserver 抖動/迴圈 | hook 只在跨門檻翻 state;rAF 包裹;單一門檻無需遲滯 |
| Medium | grid-mode 單欄堆疊順序錯亂 | 以 (row, colStart) 排序輸出 items;加 round-trip/結構測試 |
| Low | form-builder 線性表單視覺退化 | v1 截圖回歸(寬/窄)後再合併 |

## 12. 開放問題 — 已解決
1. reflow 機制 → A2 ResizeObserver(門檻可配置)。
2. 門檻 → `stackBelow` 預設 640、可配置。
3. form-builder 線性表單 → 一併容器響應式。
4. Submission → 即時(watch),非 Submit 觸發;`{data, meta}`,metadata 內建版(可自訂信封屬 ②)。
5. Canvas 版面 → Editor / Live Preview 兩段獨立收合。
