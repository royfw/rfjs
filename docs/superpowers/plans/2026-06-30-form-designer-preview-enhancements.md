# Form Designer Preview 強化 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 form-designer 產出的表單依「容器寬」真正響應式 reflow,並提供裝置/手動寬度的預覽、Canvas 內可收合的即時預覽、以及即時(watch 驅動)的送出資料 Submission 面板。

**Architecture:** `@rfjs/form-builder-ui` 的 `ConfigForm` 改用 ResizeObserver 量容器寬、依可配置門檻 `stackBelow`(預設 640)塌縮;新增 `onPayloadChange` seam 即時吐出 `{data, meta}`。`apps/web` form-designer 新增共用 `<ResponsivePreview>` 與 `<SubmissionPanel>`,Preview 頁籤用完整版、Canvas 頁改成 Editor / Live Preview 兩段獨立收合。

**Tech Stack:** TypeScript、zod v4、React、react-hook-form、ResizeObserver、Vitest、Tailwind v4、`@rfjs/web-ui`。

完整設計見 spec:`docs/superpowers/specs/2026-06-30-form-designer-preview-enhancements-design.md`。建立在 #216(已 merge,main `42b26e6`)之上。

## Global Constraints

- 測試:Vitest,`*.spec.ts(x)` 同層;每包 `pnpm -F <pkg> vitest:run <path>`。
- fresh worktree 先 `pnpm install` + `pnpm build:packages`;改 `@rfjs/form-builder` 後要 `pnpm -F @rfjs/form-builder build` 再跑 UI 測試。
- 門檻 `stackBelow` **預設 640**;來源 `config.responsive?.stackBelow`。
- reflow 一律由**容器寬**(ResizeObserver)驅動,不用 viewport media query、不用 iframe。SSR/未量到前 = 寬版(`narrow=false`)。
- `dataType` enum 不新增成員;`responsive` 為 additive optional。
- Submission 面板放響應式框**外**;即時(watch),不靠 Submit。
- ② 動作/按鈕模型不在本計劃;`onPayloadChange` 的 `meta` 預留給它擴充。
- commit/PR 英文(conventional,結尾 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`);本計劃/spec 繁中。
- HOLD PR —— 使用者自行 merge。

---

## Task 1: 引擎 `FormConfig.responsive.stackBelow`

**Files:**
- Modify: `packages/form-builder/src/types.ts`
- Modify: `packages/form-builder/src/config-schema.ts`
- Test: `packages/form-builder/src/config-schema.spec.ts`

**Interfaces:**
- Produces:`FormConfig.responsive?: { stackBelow?: number }`;schema 驗證並 round-trip。

- [ ] **Step 1: 寫失敗測試**
```ts
it("accepts and round-trips responsive.stackBelow", () => {
  const cfg = { version: 1, sections: [{ id: "s", title: "S", rows: [] }], responsive: { stackBelow: 540 } };
  const parsed = formConfigSchema.parse(cfg as any);
  expect(parsed.responsive?.stackBelow).toBe(540);
  expect(JSON.parse(JSON.stringify(parsed))).toEqual(cfg);
});
it("allows omitting responsive", () => {
  expect(formConfigSchema.safeParse({ version: 1, sections: [{ id: "s", title: "S", rows: [] }] }).success).toBe(true);
});
```

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts`
Expected: FAIL(`responsive` 被 strip / 不認得)。

- [ ] **Step 3: 實作**
- `types.ts`:`FormConfig` interface 加 `responsive?: { stackBelow?: number };`
- `config-schema.ts`:`FormConfigSchema` 物件加 `responsive: z.object({ stackBelow: z.number().positive().optional() }).optional(),`

- [ ] **Step 4: 跑測試確認通過 + 全包**
Run: `pnpm -F @rfjs/form-builder vitest:run` → PASS。然後 `pnpm -F @rfjs/form-builder build`(產 dist 供下游)。

- [ ] **Step 5: Commit**
```bash
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts
git commit -m "feat(form-builder): add FormConfig.responsive.stackBelow"
```

---

## Task 2: `useContainerBreakpoint` hook

**Files:**
- Create: `packages/form-builder-ui/src/use-container-breakpoint.ts`
- Test: `packages/form-builder-ui/src/use-container-breakpoint.spec.ts`

**Interfaces:**
- Produces:`useContainerBreakpoint(ref: React.RefObject<HTMLElement>, breakpoint: number): boolean`(容器寬 < breakpoint → true;SSR/未量到 → false;只在跨門檻時更新 state)。

- [ ] **Step 1: 寫失敗測試**
```tsx
import { renderHook, act } from "@testing-library/react";
import * as React from "react";
import { useContainerBreakpoint } from "./use-container-breakpoint";

// 可控 ResizeObserver mock:捕捉 callback,讓測試手動觸發
let cb: (e: any[]) => void;
beforeEach(() => {
  cb = () => {};
  (globalThis as any).ResizeObserver = class {
    constructor(c: any) { cb = c; }
    observe() {} disconnect() {}
  };
});

it("starts false (SSR-safe) and flips when width < breakpoint", () => {
  const ref = { current: document.createElement("div") } as React.RefObject<HTMLElement>;
  const { result } = renderHook(() => useContainerBreakpoint(ref, 640));
  expect(result.current).toBe(false);
  act(() => cb([{ contentRect: { width: 500 } }]));
  expect(result.current).toBe(true);
  act(() => cb([{ contentRect: { width: 800 } }]));
  expect(result.current).toBe(false);
});
```

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/use-container-breakpoint.spec.ts`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**
```ts
import * as React from "react";
export function useContainerBreakpoint(ref: React.RefObject<HTMLElement>, breakpoint: number): boolean {
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth;
      setNarrow((prev) => (prev === w < breakpoint ? prev : w < breakpoint));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, breakpoint]);
  return narrow;
}
```

- [ ] **Step 4: 跑測試確認通過**
Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/use-container-breakpoint.spec.ts` → PASS。

- [ ] **Step 5: Commit**
```bash
git add packages/form-builder-ui/src/use-container-breakpoint.ts packages/form-builder-ui/src/use-container-breakpoint.spec.ts
git commit -m "feat(form-builder-ui): add useContainerBreakpoint (ResizeObserver, SSR-safe)"
```

---

## Task 3: ConfigForm 容器響應式塌縮(R)

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes:Task 1 `config.responsive.stackBelow`、Task 2 `useContainerBreakpoint`。
- Produces:ConfigForm 在容器寬 < `stackBelow` 時:外層 grid、grid-mode section grid、flow section grid 皆塌成單欄;grid-mode items 以 (row, colStart) 順序堆疊、`gridColumn` 收為 `1 / -1`。

- [ ] **Step 1: 寫失敗測試**(用可控 ResizeObserver mock,如 Task 2)
```tsx
it("collapses grid-mode section to single column when container is narrow", () => {
  // render 一個含 layout.placements 的 section(2 個 items:colStart 1/7,colSpan 6)
  // 觸發 ResizeObserver width=400(<640)
  // 斷言:section grid 的 inline gridTemplateColumns === "1fr",且兩個 item 的 gridColumn === "1 / -1"
});
it("keeps multi-column when wide (>= stackBelow)", () => {
  // width=900 → gridTemplateColumns 含 "repeat(", item 維持 placement 的 span
});
it("honors config.responsive.stackBelow override", () => {
  // stackBelow=480;width=520 → 仍寬版(不塌);width=400 → 塌
});
```
(用 `data-testid="form-grid"`(config-form.tsx 既有,line 263)定位 section grid;item 用 `data-key`/`data-testid` 取 inline style。)

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F @rfjs/form-builder build && pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL(目前用 `md:` 視窗、內層寫死,不依容器塌)。

- [ ] **Step 3: 實作 config-form.tsx**
- 取得門檻與 narrow:
```ts
const rootRef = React.useRef<HTMLFormElement | null>(null);
const stackBelow = config.responsive?.stackBelow ?? 640;
const narrow = useContainerBreakpoint(rootRef as React.RefObject<HTMLElement>, stackBelow);
```
- `<form ref={rootRef} …>`。
- 外層 grid(目前 `className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--form-cols),minmax(0,1fr))]"`,line 243):移除 `md:[…]`,className 留 `"grid gap-4"`,改 inline:
```ts
style={{ gridTemplateColumns: narrow ? "1fr" : "repeat(var(--form-cols), minmax(0, 1fr))", ["--form-cols" as any]: String(columns) }}
```
- grid-mode section grid(line 265):`gridTemplateColumns: narrow ? "1fr" : \`repeat(${layout.columns}, minmax(0, 1fr))\``。並於 narrow 時依 placement 排序 items 後再 map:
```ts
const ordered = narrow
  ? [...items].sort((a, b) => { const pa = byId.get(a.id), pb = byId.get(b.id);
      return (pa?.row ?? 0) - (pb?.row ?? 0) || (pa?.colStart ?? 0) - (pb?.colStart ?? 0); })
  : items;
```
- flow section grid(line 286):`gridTemplateColumns: narrow ? "1fr" : \`repeat(${sectionCols}, minmax(0, 1fr))\``。
- `renderItem` / `placementStyle`(line 137-141)與 `fieldSpanStyle`:narrow 時忽略 placement 與 span,套 `{ gridColumn: "1 / -1" }`(把 `narrow` 傳進 renderItem,或在呼叫端覆寫 style)。

- [ ] **Step 4: 跑測試確認通過 + 回歸**
Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: 新測試 PASS;既有 config-form / form-builder 測試全綠(線性表單寬版仍多欄)。

- [ ] **Step 5: Commit**
```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "feat(form-builder-ui): container-driven responsive collapse (ResizeObserver + stackBelow)"
```

---

## Task 4: ConfigForm `computePayload` + `onPayloadChange`(①)

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`
- Modify: `packages/form-builder-ui/src/config-form-builder.tsx`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Produces:
```ts
export interface SubmissionMeta { valid: boolean; errors: Record<string, string>; visibleKeys: string[]; schemaVersion?: number; }
// ConfigFormProps 加:
onPayloadChange?: (p: { data: Record<string, unknown>; meta: SubmissionMeta }) => void;
```
  `computePayload(values, config) => Record<string, unknown>`(由現有 submit handler 抽出);`ConfigFormBuilder` 轉發 `onPayloadChange`。

- [ ] **Step 1: 寫失敗測試**
```tsx
it("emits live payload (data + meta) on value change without submit", async () => {
  const onPayloadChange = vi.fn();
  // render ConfigForm(含一個 required Name)+ onPayloadChange
  // 在 Name 輸入 "Ann"
  // 斷言:onPayloadChange 最後一次的 arg.data.name === "Ann";arg.meta.valid 為 true/false 隨驗證
});
it("excludes conditionally-hidden fields from payload + visibleKeys", async () => {
  // 一個 conditional 欄位被隱藏 → data 不含其 key、meta.visibleKeys 不含它
});
it("meta.valid false + errors when required empty", () => {
  // 未填 required → meta.valid === false 且 errors 含該 key
});
```

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL(無 `onPayloadChange`)。

- [ ] **Step 3: 實作**
- 把目前 submit handler(line 233-241)建 `out` 的邏輯抽成模組層純函式 `computePayload(values: Record<string, unknown>, config: FormConfig): Record<string, unknown>`(保留 conditional 過濾與形狀);`onSubmit` 改呼叫 `onSubmit(computePayload(all, config))`。
- 加 prop `onPayloadChange?`;用 `useWatch({ control })` 取即時值,`React.useEffect` 在值變動時:
```ts
const data = computePayload(values, config);
const parsed = schema.safeParse(data); // schema = configToZod(config),沿用 resolver 已建的
const errors: Record<string,string> = {};
if (!parsed.success) for (const i of parsed.error.issues) { const k = String(i.path[0]); if (k && !errors[k]) errors[k] = i.message; }
onPayloadChange?.({ data, meta: { valid: parsed.success, errors, visibleKeys: Object.keys(data), schemaVersion: config.version } });
```
- `config-form-builder.tsx`:`ConfigFormBuilderProps` 加 `onPayloadChange?`,在預覽 `<ConfigForm>` 轉發(比照 `fetcher`)。export `SubmissionMeta` 於 `index.ts`。

- [ ] **Step 4: 跑測試確認通過 + 全包**
Run: `pnpm -F @rfjs/form-builder-ui vitest:run` → PASS(含回歸)。

- [ ] **Step 5: Commit**
```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form-builder.tsx packages/form-builder-ui/src/config-form.spec.tsx packages/form-builder-ui/src/index.ts
git commit -m "feat(form-builder-ui): live onPayloadChange seam (data + submission meta)"
```

---

## Task 5: `<ResponsivePreview>` 元件

**Files:**
- Create: `apps/web/src/tools/form-designer/responsive-preview.tsx`
- Create: `apps/web/src/tools/form-designer/responsive-preview.spec.tsx`

**Interfaces:**
- Produces:
```ts
export interface ResponsivePreviewProps {
  children: React.ReactNode; width: number; onWidthChange: (w: number) => void;
  min?: number; max?: number; compact?: boolean;
}
export function ResponsivePreview(props: ResponsivePreviewProps): JSX.Element;
```

- [ ] **Step 1: 寫失敗測試**
```tsx
it("preset button sets width", async () => {
  const onWidthChange = vi.fn();
  render(<ResponsivePreview width={1100} onWidthChange={onWidthChange}><div>form</div></ResponsivePreview>);
  await userEvent.click(screen.getByRole("button", { name: /mobile/i }));
  expect(onWidthChange).toHaveBeenCalledWith(375);
});
it("number input clamps to [min,max]", async () => {
  const onWidthChange = vi.fn();
  render(<ResponsivePreview width={500} min={320} max={1280} onWidthChange={onWidthChange}><div/></ResponsivePreview>);
  const num = screen.getByRole("spinbutton");
  await userEvent.clear(num); await userEvent.type(num, "99999");
  expect(onWidthChange).toHaveBeenLastCalledWith(1280);
});
it("renders children inside a width-constrained frame", () => {
  render(<ResponsivePreview width={400} onWidthChange={()=>{}}><div data-testid="kid"/></ResponsivePreview>);
  const frame = screen.getByTestId("rp-frame");
  expect(frame.style.width).toBe("400px");
  expect(screen.getByTestId("kid")).toBeDefined();
});
```

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F web vitest:run src/tools/form-designer/responsive-preview.spec.tsx`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**
- 裝置預設鈕(Mobile 375 / Tablet 768 / Desktop = `max ?? 1280`);range(min..max)+ number(`role=spinbutton`);兩者夾值 `Math.max(min, Math.min(max, w))` 後 `onWidthChange`。
- 框:`<div data-testid="rp-frame" style={{ width: width+"px", maxWidth:"100%", margin:"0 auto" }}>{children}</div>`,右緣可拖曳把手(pointerdown/move 算寬、夾值、`onWidthChange`)。
- 顯示當前寬度標籤;`compact` 時縮小控制列/間距。用 `@rfjs/web-ui` 既有 Button/Input 與 `cn()`(對齊 design system)。

- [ ] **Step 4: 跑測試確認通過**
Run: `pnpm -F web vitest:run src/tools/form-designer/responsive-preview.spec.tsx` → PASS。

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/tools/form-designer/responsive-preview.tsx apps/web/src/tools/form-designer/responsive-preview.spec.tsx
git commit -m "feat(web): ResponsivePreview (device presets + manual width + drag)"
```

---

## Task 6: `<SubmissionPanel>` 元件

**Files:**
- Create: `apps/web/src/tools/form-designer/submission-panel.tsx`
- Create: `apps/web/src/tools/form-designer/submission-panel.spec.tsx`

**Interfaces:**
- Consumes:Task 4 的 payload 形狀 `{ data; meta: SubmissionMeta }`(從 `@rfjs/form-builder-ui` import 型別)。
- Produces:`SubmissionPanel({ payload, compact? })` —— 即時呈現 `meta` + `data`(格式化 JSON),`meta.valid` 顯示有效/無效 + errors。

- [ ] **Step 1: 寫失敗測試**
```tsx
it("renders data and meta; shows valid state", () => {
  render(<SubmissionPanel payload={{ data: { name: "Ann" }, meta: { valid: true, errors: {}, visibleKeys: ["name"] } }} />);
  expect(screen.getByText(/"name": "Ann"/)).toBeDefined();
  expect(screen.getByText(/valid/i)).toBeDefined();
});
it("shows invalid + errors", () => {
  render(<SubmissionPanel payload={{ data: {}, meta: { valid: false, errors: { name: "Required" }, visibleKeys: [] } }} />);
  expect(screen.getByText(/Required/)).toBeDefined();
});
it("renders empty-state when payload is null", () => {
  render(<SubmissionPanel payload={null} />);
  expect(screen.getByText(/fill the form/i)).toBeDefined();
});
```

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F web vitest:run src/tools/form-designer/submission-panel.spec.tsx`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作**
- Props `{ payload: { data: Record<string,unknown>; meta: SubmissionMeta } | null; compact?: boolean }`。
- 兩個區塊:**Metadata**(valid badge、errors 清單、visibleKeys/schemaVersion)、**Data**(`<pre>{JSON.stringify(data, null, 2)}</pre>`)。`payload==null` → 空狀態文案(含 "fill the form")。用 web-ui 樣式/`cn()`。

- [ ] **Step 4: 跑測試確認通過**
Run: `pnpm -F web vitest:run src/tools/form-designer/submission-panel.spec.tsx` → PASS。

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/tools/form-designer/submission-panel.tsx apps/web/src/tools/form-designer/submission-panel.spec.tsx
git commit -m "feat(web): SubmissionPanel (live data + submission meta)"
```

---

## Task 7: form-designer 整合(Preview 頁籤 + Canvas 兩段收合)

**Files:**
- Modify: `apps/web/src/tools/form-designer/ui.tsx`
- Test: `apps/web/src/tools/form-designer/ui.spec.tsx`

**Interfaces:**
- Consumes:Task 3/4(ConfigForm 響應式 + `onPayloadChange`)、Task 5(`ResponsivePreview`)、Task 6(`SubmissionPanel`)。

- [ ] **Step 1: 寫失敗測試**
```tsx
it("Canvas tab has two independent collapsible sections: Editor and Live Preview", () => {
  // render 工具(canvas tab)→ 找到 "Editor" 與 "Live Preview" 兩個可收合標題;Live Preview 預設收合
});
it("Preview tab renders ResponsivePreview with device controls + a submission panel", () => {
  // 切到 preview tab → 出現裝置鈕(Mobile/Tablet/Desktop)與 submission 區塊
});
```
(沿用 `ui.spec.tsx` 既有 render helper;斷言用 role/text。)

- [ ] **Step 2: 跑測試確認失敗**
Run: `pnpm -F web vitest:run src/tools/form-designer/ui.spec.tsx`
Expected: FAIL。

- [ ] **Step 3: 實作**
- 加狀態:`const [payload, setPayload] = React.useState<…|null>(null);` 與 `const [previewW, setPreviewW] = React.useState(1100);`、`const [canvasW, setCanvasW] = React.useState(390);`。
- **Preview 頁籤**(目前 line 457-459):
```tsx
<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
  <ResponsivePreview width={previewW} onWidthChange={setPreviewW}>
    <ConfigForm config={formConfig} locale="en" fetcher={sampleFetcher} uploadHandler={sampleUploader}
      onPayloadChange={setPayload} onSubmit={() => {}} />
  </ResponsivePreview>
  <SubmissionPanel payload={payload} />
</div>
```
- **Canvas 頁**(目前 line 347-455):外層改兩個獨立 Collapsible 區塊(用 `@rfjs/web-ui` collapsible,或沿用工具現有的 section 收合元件):
  1. **Editor**(預設展開):內含現有 grid + `aside` inspector(原 line 388-454 內容)。
  2. **Live Preview**(預設收合):
```tsx
<ResponsivePreview compact width={canvasW} onWidthChange={setCanvasW}>
  <ConfigForm config={formConfig} locale="en" fetcher={sampleFetcher} uploadHandler={sampleUploader} onPayloadChange={setPayload} onSubmit={() => {}} />
</ResponsivePreview>
<SubmissionPanel compact payload={payload} />
```
- 兩個 Collapsible 各自獨立開合(非手風琴)。

- [ ] **Step 4: 跑測試 + 型別**
Run: `pnpm -F web vitest:run src/tools/form-designer && pnpm -F web check-types`
Expected: PASS、exit 0。

- [ ] **Step 5: 瀏覽器截圖驗證**
啟動 `pnpm --filter web exec next dev -p 3362`,開 `/en/tools/form-designer`:
- Preview 頁籤拖到 375 / 768 / 1280,截圖確認塌縮(<640 單欄)與 SubmissionPanel 即時更新。
- Canvas 頁展開 Live Preview、收合 Editor,截圖確認兩段獨立收合。

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/tools/form-designer/ui.tsx apps/web/src/tools/form-designer/ui.spec.tsx
git commit -m "feat(web): wire responsive preview + live submission into form-designer (two-collapsible Canvas)"
```

---

## 收尾
- [ ] 全量回歸:`pnpm -F @rfjs/form-builder vitest:run && pnpm -F @rfjs/form-builder-ui vitest:run && pnpm -F web vitest:run src/tools/form-designer && pnpm -F web check-types`
- [ ] changeset:`@rfjs/form-builder` minor(新增 `responsive`)、`@rfjs/form-builder-ui` minor(`onPayloadChange`/`useContainerBreakpoint`/容器響應式;**private 但仍記 changelog**)。
- [ ] 開 PR(英文)。標題:`feat(form-designer): responsive preview + live submission`。內文連結 spec/plan、說明 R(容器響應式,form-builder 線性表單一併受益)/ P / ① 與 ②(動作模型)延後。**等使用者「merged」。**

## Self-Review 對照(spec → task)
- §4 R:`responsive.stackBelow` → Task 1;`useContainerBreakpoint` → Task 2;ConfigForm 塌縮 + 堆疊序 + 移除 `md:` → Task 3;form-builder v1 回歸 → Task 3 Step 4。✅
- §5 P:`ResponsivePreview` → Task 5;Preview 頁籤 + Canvas 兩段收合 → Task 7。✅
- §6 ①:`computePayload` + `onPayloadChange` + `SubmissionMeta` → Task 4;Submission 面板(框外)→ Task 6 + Task 7。✅
- §7 契約:`responsive`、`onPayloadChange`、`SubmissionMeta` → Task 1/4。✅
- §9 測試:各 Task 的 TDD + 收尾全量 + Task 7 截圖。✅
- §10 擴充點(②接同一 seam):不寫 code,計劃不堵死(`meta` 物件可擴充)。✅
- §11 風險:SSR 寬版預設(Task 2/3 行為)、堆疊序(Task 3 排序)、v1 回歸(Task 3 Step 4)。✅
