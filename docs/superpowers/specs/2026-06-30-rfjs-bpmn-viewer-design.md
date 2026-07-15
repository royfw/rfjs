# @rfjs/bpmn — BPMN 流程圖檢視器(viewer)設計

- 日期:2026-06-30
- 分支 / worktree:`feat-bpmn-viewer`（`.claude/worktrees/feat-bpmn-viewer`，由 `origin/main` 建立）
- 狀態:設計已核可，待寫實作計畫（writing-plans）

## 1. 目標與背景

把 `bpmn-js`（BPMN 2.0 檢視/模型，基於 diagram-js + bpmn-moddle，vanilla JS、命令式 API）封裝成 rfjs stack 使用的 **React 元件**，作為未來自建 BPM 流程網站的第一個探路小套件。

本階段**只做 viewer（唯讀）**：讀 BPMN XML → 渲染、縮放、平移、fit-to-view。modeler（編輯）留待下一階段。

### 已鎖定決策

| 決策 | 結論 |
| --- | --- |
| 範圍 | 只做 viewer（唯讀）；不做 modeler、不做匯出、不做 minimap |
| 發佈 | workspace 內部 **private** 套件，不發 npm（避開 bpmn.io 授權的發佈問題） |
| 授權 | bpmn.io license（非 MIT）——**必須保留** viewer 內建的「Powered by bpmn.io」標誌連結，**絕不**用 CSS 隱藏 |
| 套件邊界 | **無頭薄封裝**：套件只給 `<BpmnViewer>` + `useBpmnViewer` hook + 型別；工具列/範例/上傳/錯誤面板等外殼留在 `apps/web` 展示頁 |
| Wrapper API | **Both**：controlled `xml` prop + ref handle（低階）並存，外加 `useBpmnViewer` hook（人體工學包裝） |
| Demo 範圍 | 內建範例 + 貼上 XML + **檔案上傳** + 工具列（zoom/fit/reset）+ 錯誤面板 + bpmn.io 標誌 + en/zh-TW i18n |
| 測試 | mock bpmn-js 的單元測試 + 純函式測試 + **Playwright e2e** 真 SVG 煙霧測試 |
| viewer 變體 | `NavigatedViewer`（滑鼠滾輪縮放 + 拖曳平移 + 鍵盤），仍唯讀 |

### 依賴事實（已查證）

- `bpmn-js@18.19.0`（最新），**內建 TypeScript 型別**（`./lib/index.d.ts`，`NavigatedViewer` 亦有），**無 peerDependencies**（自帶 diagram-js / bpmn-moddle 等為一般 deps）。
- CSS 隨 `bpmn-js/dist/assets/` 出貨；確切檔名於 `pnpm add bpmn-js` 安裝後鎖定（預期為 `diagram-js.css` + `bpmn-js.css` + bpmn 字型 CSS）。

## 2. 架構總覽

```
packages/bpmn/  (@rfjs/bpmn, private)              ← 薄封裝 bpmn-js NavigatedViewer
        │  <BpmnViewer> + useBpmnViewer + types
        ▼  (Next.js transpilePackages 串接，無 build step)
apps/web/src/tools/bpmn-viewer/                    ← 展示頁(/tools/bpmn-viewer)
        工具列 + 範例 + 檔案上傳/貼上 + 錯誤面板（用 @rfjs/web-ui 組外殼）
```

**分層哲學**：與既有 `@rfjs/filter-builder-ui` 一致——套件只給「核心可重用元件 + hook」，頁面外殼（chrome）由 app 負責。這讓核心套件乾淨、可重用，未來 modeler 或別處嵌 BPMN 圖時不被某一套工具列樣式綁死。

**與並行 form 工作的關係**：`@rfjs/bpmn` 套件與 `apps/web/src/tools/bpmn-viewer/` 皆為全新檔案，零重疊。唯一觸及的共用檔為「註冊用」檔案（見 §4），皆為 **append** 性質，與 `feat-form-preview-enhancements` 分支改動的 form 既有條目不同行，合併理論上不衝突。本分支 **HOLD PR**，由人工於 GitHub 合併；若合併時真衝突再處理。

## 3. `@rfjs/bpmn` 套件設計

### 3.1 檔案布局（flat，小套件；比照 filter-builder-ui kebab-case）

```
packages/bpmn/
  package.json          private, type:module, exports "./src/index.ts", react peer, bpmn-js dep
  tsconfig.json         比照 filter-builder-ui（target ES2022 / Bundler / react-jsx / strict / noEmit）
  vitest.config.mts     environment: jsdom；include src/**/*.spec.(ts|tsx)
  src/
    index.ts            barrel：re-export 公開介面
    bpmn-viewer.tsx     "use client" — <BpmnViewer> controlled component + forwardRef
    use-bpmn-viewer.ts  useBpmnViewer hook
    zoom.ts             純函式：zoom step / clamp
    types.ts            BpmnViewerProps / BpmnViewerHandle / BpmnImportResult / BpmnViewerError
    bpmn-viewer.spec.tsx
    use-bpmn-viewer.spec.ts
    zoom.spec.ts
  README.md
  README.zh-TW.md
```

### 3.2 公開型別（`types.ts`）

```ts
export interface BpmnImportResult {
  warnings: unknown[]; // bpmn-js importXML 回傳的 warnings
}

export interface BpmnViewerError {
  message: string;
  warnings?: unknown[];
  cause?: unknown;
}

export interface BpmnViewerProps {
  /** 受控的 BPMN 2.0 XML 字串 */
  xml: string;
  /** 透傳給 NavigatedViewer 建構子的額外選項 */
  options?: Record<string, unknown>;
  className?: string;
  style?: React.CSSProperties;
  /** importXML 成功（可能含 warnings） */
  onImport?: (result: BpmnImportResult) => void;
  /** importXML 失敗 */
  onError?: (error: BpmnViewerError) => void;
  /** import 進行中狀態變化 */
  onLoadingChange?: (loading: boolean) => void;
}

export interface BpmnViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;       // = fitViewport
  fitViewport(): void;
  getZoom(): number;
  getViewer(): unknown;    // 逃生艙：回傳底層 NavigatedViewer 實例
}
```

### 3.3 元件契約與生命週期（`bpmn-viewer.tsx`）

- `"use client"`；`forwardRef<BpmnViewerHandle, BpmnViewerProps>`。
- **建立（mount，client effect）**：動態 `import('bpmn-js/lib/NavigatedViewer')` → `new NavigatedViewer({ container })`。動態 import + `"use client"` 雙保險，確保 SSR 期不觸碰 DOM。
- **匯入（`xml` 變更）**：`await viewer.importXML(xml)`。
  - **競態保護**：每次 import 標記序號 / AbortController，只有「最後一次」import 的結果生效；元件已卸載則丟棄結果。
  - 成功 → `onLoadingChange(false)`、`onImport({ warnings })`；fit 一次 viewport。
  - 失敗 → `onLoadingChange(false)`、`onError({ message, warnings, cause })`，並保留錯誤狀態。
- **卸載(unmount)**：`viewer.destroy()`。
- **縮放**（透過 `canvas = viewer.get('canvas')`）：
  - `fitViewport` / `resetZoom` = `canvas.zoom('fit-viewport')`。
  - `zoomIn` / `zoomOut` = 取現值 `canvas.zoom()`，乘以 step，`clamp(min, max)`（邏輯在 `zoom.ts` 純函式）。
  - `getZoom` = `canvas.zoom()`。
- **授權硬約束**：`NavigatedViewer` 會自動在容器右下角加入 `.bjs-powered-by` 的 bpmn.io 標誌連結。本套件 **不得** 加入任何隱藏該元素的 CSS / DOM 操作。spec 視為硬約束，並以測試守護（見 §5）。
- **容器尺寸**：容器需有明確高度才能渲染；props 提供 `className` / `style`，由展示頁給定高度（例 `h-[600px]`）。

### 3.4 `useBpmnViewer()` hook（`use-bpmn-viewer.ts`）

人體工學包裝，讓展示頁綁工具列按鈕更省事：

```ts
const v = useBpmnViewer();
// v = { viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error }
// viewerProps = { ref, onLoadingChange, onError }，直接 spread 到元件
<BpmnViewer {...v.viewerProps} xml={xml} />
<Button onClick={v.zoomIn}>＋</Button>
```

- 內部持有 `ref`（`BpmnViewerHandle`），`zoomIn/...` 代理到 ref。
- `viewerProps` 是一個可 spread 的物件（`{ ref, onLoadingChange, onError }`）；hook 在內部封裝 `onLoadingChange` / `onError` 來驅動 `importing` / `error` 狀態，呼叫端只要 `{...v.viewerProps}` 即可，不暴露內部 handler。
- 呼叫端若另傳自己的 `onImport` / `onError`，於元件層合併（plan 決定合併細節）。
- **Both 的落實**：低階 = `ref` handle；高階 = 此 hook。兩者並存，使用者可擇一。

### 3.5 CSS

- 套件在元件檔 `import` bpmn-js 隨附的 CSS（`diagram-js.css` + `bpmn-js.css` + bpmn 字型 CSS；確切路徑安裝後鎖定）。Next.js `transpilePackages` 會處理這些 CSS import。
- 套件 **不使用 Tailwind**，因此 `apps/web` **不需** 加 Tailwind `@source`（只需 `transpilePackages`）。

### 3.6 套件 `package.json` 要點（比照 filter-builder-ui）

- `"name": "@rfjs/bpmn"`、`"private": true`、`"type": "module"`、`"version": "0.0.0"`。
- `"exports": { ".": "./src/index.ts" }`（無 build / dist，source 直接被 transpile）。
- scripts：`lint`（`eslint . --max-warnings 0`）、`check-types`（`tsc --noEmit`）、`test` / `vitest:run`（`vitest --run`）。
- `dependencies`：`bpmn-js@^18.19.0`。
- `peerDependencies`：`react`、`react-dom`（`^19`）。
- `devDependencies`：比照 filter-builder-ui（react、@types/react(-dom)、@testing-library/react、@testing-library/dom、jsdom、vitest、eslint 套組、typescript）。
- **不依賴** `@rfjs/web-ui`。

## 4. `apps/web` tool：`bpmn-viewer`

### 4.1 registry 條目（`packages/web-core/src/registry/tools.ts`，append）

```ts
{
  id: 'bpmn-viewer',
  category: 'inspect',
  surface: 'web',
  status: 'preview',
  relatedPackages: ['@rfjs/bpmn'],
  tags: ['diagram', 'bpmn', 'workflow', 'viewer'],
}
```

### 4.2 tool 模組檔案

```
apps/web/src/tools/bpmn-viewer/
  index.ts        export const tool: ToolModule = { id:'bpmn-viewer', Component: BpmnViewerTool }
  ui.tsx          "use client" — 命名匯出 BpmnViewerTool()
  messages.ts     LocaleMessages：Tools['bpmn-viewer'].{title,description}（en + zh-TW）+ UI 字串
  samples.ts      純資料：2–3 個內建範例 BPMN XML（如「請假流程」「訂單審核」）
  file-input.ts   純函式：副檔名（.bpmn/.xml）+ 檔案大小驗證
  ui.spec.tsx / samples.spec.ts / file-input.spec.ts（co-located）
```

### 4.3 UI（`ui.tsx`，`"use client"`）

- **工具列**：放大 / 縮小 / 重設 / fit 按鈕（`@rfjs/web-ui` Button + lucide 圖示），綁 `useBpmnViewer`。
- **來源切換**：
  - 範例選單(Select)——選 `samples.ts` 內建流程圖。
  - 檔案上傳——`<input type="file" accept=".bpmn,.xml">`，`FileReader.readAsText` 讀入；經 `file-input.ts` 驗證（副檔名 + 大小），失敗顯示錯誤。
  - 貼上 XML——textarea，按鈕套用。
- **中央**：`<BpmnViewer xml={xml} className="h-[600px] w-full rounded-md border" ... />`。
- **錯誤面板**：XML 無效 / 上傳不合法時顯示訊息（i18n）。
- **bpmn.io 標誌**：由 viewer 自帶（不額外處理，僅確保不隱藏）。
- **i18n**：en + zh-TW。`Tools['bpmn-viewer'].{title,description}` + UI 字串（比照 form-designer 的 `ToolUI` / 自有命名空間做法）。

### 4.4 註冊接線（皆為 append）

- `apps/web/src/tools/index.ts`：`import { tool as bpmnViewer } from './bpmn-viewer'` → 加入 `toolModules`。
- `apps/web/src/tools/messages.ts`：`import { messages as bpmnViewer } from './bpmn-viewer/messages'` → 加入 `toolMessages`（順序與 index.ts 對齊）。
- `apps/web/src/tools/index.spec.ts`：`EXPECTED_WEB_TOOL_IDS` 加 `'bpmn-viewer'`。
- `apps/web/next.config.js`：`transpilePackages` 加 `'@rfjs/bpmn'`。
- 路由由 registry slug 自動驅動（`/tools/bpmn-viewer`，`generateStaticParams` 自動涵蓋），無需手動加路由檔。
- **不需** 改 `apps/web/src/app/globals.css` 的 `@source`（套件無 Tailwind）。

## 5. 測試策略

### 5.1 套件單元（jsdom + vitest，`vi.mock`）

mock `bpmn-js/lib/NavigatedViewer`（jsdom 無 SVG layout，真渲染靠 e2e），驗證 **wrapper 契約**：

- mount → 以含 `container` 的選項 `new NavigatedViewer(...)`。
- 設定 / 變更 `xml` → `importXML(xml)` 被呼叫；**競態**：先發後到的舊 import 結果被丟棄，只有最後一次生效。
- unmount → `destroy()` 被呼叫。
- `importXML` reject → `error` 狀態 + `onError`；resolve 帶 warnings → `onImport({ warnings })`；`onLoadingChange` true→false 流。
- ref handle：`zoomIn/zoomOut/resetZoom/fitViewport/getZoom` → 呼叫對應 `canvas.zoom(...)` 參數。
- SSR 安全:在無瀏覽器 API 假設下 render 不崩（或以「未呼叫 importXML 直到 effect」驗證）。
- **bpmn.io 標誌守護**：以程式碼/DOM 斷言確認本套件未加入隱藏 `.bjs-powered-by` 的規則。

### 5.2 純函式單元

- `zoom.ts`：step 計算、min/max clamp 邊界。
- `file-input.ts`：副檔名允許/拒絕、大小上限邊界。
- `samples.ts`:每個範例為非空、可被解析的 XML 字串（結構性檢查）。

### 5.3 hook 單元

`useBpmnViewer`：actions 代理到 ref；`importing` / `error` 狀態流。

### 5.4 Playwright e2e（真 SVG 煙霧測試）

真瀏覽器開 `/tools/bpmn-viewer`：

- 載入內建範例 → 斷言 `.djs-container svg` 內有節點渲染。
- 按 fit / zoom → viewport / zoom 值改變。
- 貼上無效 XML → 錯誤面板出現。
- 斷言 bpmn.io 標誌（`.bjs-powered-by`）可見。
- 確切跑法（Playwright 直開 dev server vs vitest browser mode）於 plan 階段決定。

## 6. 不做（YAGNI）

modeler / 編輯、發 npm、minimap、匯出 SVG/PNG、多圖比較、自訂 BPMN 元素 renderer。全部留待未來，保持「薄探路套件」。

## 7. 風險與已知事項

- **jsdom 無 SVG layout**：真渲染只能靠 Playwright e2e；單元測試靠 mock。
- **bpmn-js CSS 檔名**：確切路徑待 `pnpm add bpmn-js` 後鎖定。
- **共用檔 append 衝突風險**：`web-core/tools.ts`、`apps/web tools/{index,messages}.ts`、`tools/index.spec.ts` 與並行 form 分支共用；皆 append，理論上不撞，合併時留意。
- **授權**:bpmn.io 標誌必須保留（硬約束，測試守護）。

## 8. 慣例

- commit / PR:英文 conventional commits，結尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- spec / plan:繁體中文。
- 全程於 `feat-bpmn-viewer` worktree 內編輯 / 測試 / commit。
- **HOLD PR**:由人工於 GitHub 合併後再續。
