# Form Designer 進階輸入元件 實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 form-designer 與表單引擎補上 form-js 等級的元件廣度(CheckboxGroup/TagList + 露出 Radio/Checkbox + description/disabled/readOnly)與兩個進階輸入(FileUpload、Signature),並為 ws/wss 遠端簽名留好接縫。

**Architecture:** 引擎(`@rfjs/form-builder`)擴 component union / zod;renderer(`@rfjs/form-builder-ui`)新增渲染與兩個注入式執行期 prop(`uploadHandler`/`signatureTransport`);`@rfjs/web-ui` 新增 `<SignaturePad>`、`<TagInput>`;`apps/web` 的 form-designer 補 model/inspector/palette。值的形狀固定、擷取方式可插拔,所以未來換遠端簽名零 schema 變更。

**Tech Stack:** TypeScript、zod v4、React、react-hook-form、Vitest、shadcn/Radix(`@rfjs/web-ui`)、`signature_pad`、`cmdk`。

完整設計見 spec:`docs/superpowers/specs/2026-06-30-form-designer-rich-inputs-design.md`。

## Global Constraints

- 測試框架:Vitest;測試與原始碼同層(`src/**/*.spec.ts(x)`)。每包用 `pnpm -F <pkg> vitest:run <path>`。
- 引擎建置成 dist;UI 包(form-builder-ui、web-ui、apps/web)以原始碼透過 Next `transpilePackages` 消費。fresh worktree 要先 `pnpm install` + `pnpm build:packages`。
- `dataType` enum **不新增成員**;新元件只用既有 `boolean`/`array`/`object`/`string`。
- 可插拔接縫(`fetcher`/`uploadHandler`/`signatureTransport`)**一律是執行期 prop,不進 `FormConfig`**。
- `description` 用 `LocalizedLabel`(`union(string, record)`),`placeholder` 維持純字串。
- commit / PR 用英文;本計劃與 spec 用繁中。conventional commits,結尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- 兩批次嚴格依序:先完成 **Batch F1(Task 1–5)**,再做 **Batch F1-rich(Task 6–9)**。共用檔案的修改在同一任務內做完,不要逐元件拆。

---

## Batch F1 — 常見元件 + 欄位屬性

### Task 1: 引擎型別 + config-schema(CheckboxGroup/TagList + 三個屬性)

**Files:**
- Modify: `packages/form-builder/src/types.ts`
- Modify: `packages/form-builder/src/config-schema.ts`
- Test: `packages/form-builder/src/config-schema.spec.ts`

**Interfaces:**
- Produces:
  - `FieldComponent` 新增字面量 `'CheckboxGroup' | 'TagList'`(union 在 types.ts 第 29–38 行)。
  - `FieldConfig` 新增:`description?: LocalizedLabel`、`disabled?: boolean`、`readOnly?: boolean`、`creatable?: boolean`(供 TagList)。
  - `fieldConfigSchema` 對上述欄位驗證;TagList 在 `creatable !== true` 時 `options` 必填(`superRefine`)。
  - `conditionSchema` 保留 `elementType?: string`。

- [ ] **Step 1: 寫失敗測試**

在 `config-schema.spec.ts` 新增:

```ts
import { fieldConfigSchema, formConfigSchema } from "./config-schema";

it("accepts CheckboxGroup with description/disabled/readOnly", () => {
  const r = fieldConfigSchema.safeParse({
    key: "tags", label: "Tags", component: "CheckboxGroup",
    options: [{ label: "A", value: "a" }],
    description: "pick some", disabled: false, readOnly: true,
  });
  expect(r.success).toBe(true);
});

it("requires options for non-creatable TagList", () => {
  const r = fieldConfigSchema.safeParse({ key: "t", label: "T", component: "TagList" });
  expect(r.success).toBe(false);
});

it("allows creatable TagList without options", () => {
  const r = fieldConfigSchema.safeParse({ key: "t", label: "T", component: "TagList", creatable: true });
  expect(r.success).toBe(true);
});

it("preserves description (LocalizedLabel record) and elementType on round-trip", () => {
  const cfg = {
    sections: [{ id: "s", title: "S", rows: [{ id: "r", items: [
      { key: "tags", label: { en: "Tags", "zh-TW": "標籤" }, component: "CheckboxGroup",
        description: { en: "help", "zh-TW": "說明" }, options: [{ label: "A", value: "a" }],
        conditional: { field: "tags", operator: "terms", value: ["a"], elementType: "string" } },
    ] }] }],
  };
  const parsed = formConfigSchema.parse(cfg);
  expect(JSON.parse(JSON.stringify(parsed))).toEqual(cfg);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts`
Expected: FAIL(component enum 不含 CheckboxGroup/TagList、缺欄位、elementType 被 strip)。

- [ ] **Step 3: 實作 types.ts**

`FieldComponent` union 加 `| 'CheckboxGroup' | 'TagList'`。`FieldConfig` interface 加:
```ts
description?: LocalizedLabel;
disabled?: boolean;
readOnly?: boolean;
creatable?: boolean; // TagList: 允許自由輸入
```

- [ ] **Step 4: 實作 config-schema.ts**

- component enum 加 `'CheckboxGroup'`、`'TagList'`。
- `fieldConfigSchema` 加(沿用既有 `localizedLabelSchema`):
```ts
description: localizedLabelSchema.optional(),
disabled: z.boolean().optional(),
readOnly: z.boolean().optional(),
creatable: z.boolean().optional(),
```
- `superRefine`:`if (val.component === "TagList" && val.creatable !== true && !(val.options?.length)) ctx.addIssue({ code: "custom", path: ["options"], message: "TagList requires options unless creatable" })`。
- `conditionSchema` 加 `elementType: z.string().optional()`(若已用 passthrough 則確認不被 strip;否則顯式加欄位)。

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts
git commit -m "feat(form-builder): add CheckboxGroup/TagList components + description/disabled/readOnly"
```

---

### Task 2: 引擎 config-to-zod(多選 array 驗證 — 地雷修正)

**Files:**
- Modify: `packages/form-builder/src/config-to-zod.ts`
- Test: `packages/form-builder/src/config-to-zod.spec.ts`

**Interfaces:**
- Consumes: Task 1 的 `FieldComponent`/`FieldConfig`。
- Produces: `configToZod`(既有匯出)對新元件產生正確驗證;行為 — CheckboxGroup/非 creatable TagList → `z.array(z.enum(values))`;creatable TagList → `z.array(z.string())`;array required → `.min(1)`;單一 Checkbox required → `z.literal(true)`。

- [ ] **Step 1: 寫失敗測試**

在 `config-to-zod.spec.ts` 新增(用既有的建 schema + parse 寫法):

```ts
it("validates CheckboxGroup as string[] not a single string", () => {
  const schema = configToZod(mkConfig({ key: "g", component: "CheckboxGroup",
    options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] }));
  expect(schema.safeParse({ g: ["a", "b"] }).success).toBe(true);
  expect(schema.safeParse({ g: "a" }).success).toBe(false);
});

it("required CheckboxGroup rejects empty array", () => {
  const schema = configToZod(mkConfig({ key: "g", component: "CheckboxGroup", required: true,
    options: [{ label: "A", value: "a" }] }));
  expect(schema.safeParse({ g: [] }).success).toBe(false);
  expect(schema.safeParse({ g: ["a"] }).success).toBe(true);
});

it("creatable TagList accepts arbitrary strings", () => {
  const schema = configToZod(mkConfig({ key: "t", component: "TagList", creatable: true }));
  expect(schema.safeParse({ t: ["anything", "new-tag"] }).success).toBe(true);
});

it("required single Checkbox must be true", () => {
  const schema = configToZod(mkConfig({ key: "agree", component: "Checkbox", required: true }));
  expect(schema.safeParse({ agree: false }).success).toBe(false);
  expect(schema.safeParse({ agree: true }).success).toBe(true);
});
```
（`mkConfig` 若 spec 檔尚無,寫一個把單一 field 包成最小 `FormConfig` 的 helper;參考檔內既有測試的建構方式。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-to-zod.spec.ts`
Expected: FAIL(目前 `baseForField` 對任何有 options 的欄位短路成單一 `z.enum`)。

- [ ] **Step 3: 實作 config-to-zod.ts**

在 `baseForField`(options 優先短路之前)加多選分支:
```ts
const MULTI = new Set(["CheckboxGroup", "TagList"]);
if (MULTI.has(field.component)) {
  if (field.component === "TagList" && field.creatable) return z.array(z.string());
  const values = (field.options ?? []).map((o) => String(o.value));
  return values.length ? z.array(z.enum(values as [string, ...string[]])) : z.array(z.string());
}
```
在 `fieldSchema` 的 required 包裝加 array 分支:對 array 值元件回 `base.min(1, requiredMsg)`;單一 `Checkbox` required 回 `z.literal(true)`(其餘維持既有 string/number 行為)。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-to-zod.spec.ts`
Expected: PASS。再跑整包確認沒回歸:`pnpm -F @rfjs/form-builder vitest:run`。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder/src/config-to-zod.ts packages/form-builder/src/config-to-zod.spec.ts
git commit -m "fix(form-builder): validate multi-value components as arrays with required .min(1)"
```

---

### Task 3: web-ui `<TagInput>` 元件

**Files:**
- Create: `packages/web-ui/src/components/tag-input.tsx`
- Create: `packages/web-ui/src/components/tag-input.spec.tsx`
- Modify: `packages/web-ui/src/index.ts`(export `TagInput`)

**Interfaces:**
- Consumes: 既有 `command.tsx`、`popover.tsx`、`input.tsx`。
- Produces:
```ts
export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  options?: { label: string; value: string }[]; // 建議清單
  creatable?: boolean;       // 允許輸入清單外的新值
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}
export function TagInput(props: TagInputProps): JSX.Element;
```

- [ ] **Step 1: 寫失敗測試**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TagInput } from "./tag-input";

it("selects an option and emits string[]", async () => {
  const onChange = vi.fn();
  render(<TagInput value={[]} onChange={onChange} options={[{ label: "Alpha", value: "a" }]} />);
  await userEvent.click(screen.getByRole("button"));
  await userEvent.click(await screen.findByText("Alpha"));
  expect(onChange).toHaveBeenCalledWith(["a"]);
});

it("creatable: adds a free-typed tag on Enter", async () => {
  const onChange = vi.fn();
  render(<TagInput value={[]} onChange={onChange} creatable />);
  const box = screen.getByRole("textbox");
  await userEvent.type(box, "custom{Enter}");
  expect(onChange).toHaveBeenCalledWith(["custom"]);
});

it("renders selected values as removable chips", () => {
  render(<TagInput value={["a"]} onChange={() => {}} options={[{ label: "Alpha", value: "a" }]} />);
  expect(screen.getByText("Alpha")).toBeInTheDocument();
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/web-ui vitest:run src/components/tag-input.spec.tsx`
Expected: FAIL(模組不存在)。

- [ ] **Step 3: 實作 tag-input.tsx**

用 `Popover` + `Command`(`CommandInput`/`CommandItem`)做下拉建議,選中的值以 chip 呈現(每個 chip 有移除鈕)。`creatable` 時:`CommandInput` 的 `onKeyDown` 攔 `Enter`,把目前輸入字串加入 `value`(去重、非空)。非 creatable 時只允許從 `options` 選。`disabled` 時停用觸發鈕與輸入。值永遠輸出 `string[]`。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/web-ui vitest:run src/components/tag-input.spec.tsx`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/web-ui/src/components/tag-input.tsx packages/web-ui/src/components/tag-input.spec.tsx packages/web-ui/src/index.ts
git commit -m "feat(web-ui): add TagInput (options + creatable) built on command/popover"
```

---

### Task 4: Renderer 渲染 CheckboxGroup/TagList + description/disabled/readOnly

**Files:**
- Modify: `packages/form-builder-ui/src/field-control.tsx`
- Test: `packages/form-builder-ui/src/field-control.spec.tsx`

**Interfaces:**
- Consumes: Task 1 的 `FieldConfig`、Task 3 的 `TagInput`、既有 web-ui `Checkbox`。
- Produces: `FieldControl` 能渲染 `CheckboxGroup`(多個 checkbox → `string[]`)、`TagList`(`<TagInput>`);所有控件套用 `description`(`resolveLabel` 渲染於 label 附近)、`disabled`、`readOnly`(原生 input/textarea → `readOnly` 屬性;radix 控件無 `readOnly` → 改用 `disabled` + `aria-readonly`)。

- [ ] **Step 1: 寫失敗測試**

```tsx
it("renders CheckboxGroup and toggles values as string[]", async () => {
  // 以既有 spec 的 render helper 包一個 CheckboxGroup field(options a/b),
  // 勾 a → 表單值 = ["a"];再勾 b → ["a","b"]
});

it("renders field description text", () => {
  // description: "help me" → 畫面出現 "help me"
});

it("readOnly text input has readonly attribute; readOnly Select carries aria-readonly", () => {
  // Input readOnly → input 有 readonly;Select readOnly → 觸發元素 aria-readonly="true" 且 disabled
});
```
（沿用 `field-control.spec.tsx` 既有的 RHF 包裝 render helper;若無則仿 `config-form.spec.tsx` 包一個 `useForm` provider。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/field-control.spec.tsx`
Expected: FAIL。

- [ ] **Step 3: 實作 field-control.tsx**

- 在元件 switch 加 `case "CheckboxGroup"`:map `options` 成多個 `Checkbox`,值為 `string[]`(勾選增減)。
- `case "TagList"`:渲染 `<TagInput value options creatable disabled />`,綁 RHF `Controller`。
- 跨切面:在所有控件統一處理 `field.description`(用 `resolveLabel(field.description, locale)` 顯示)、`field.disabled`、`field.readOnly`。原生 `input`/`textarea` 用 `readOnly`;`Select`/`Checkbox`/`RadioGroup`/`Switch`/`DatePicker` 沒有 `readOnly` 就 `disabled={disabled || readOnly}` 並加 `aria-readonly={readOnly || undefined}`。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/field-control.spec.tsx`
Expected: PASS。整包回歸:`pnpm -F @rfjs/form-builder-ui vitest:run`。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/field-control.tsx packages/form-builder-ui/src/field-control.spec.tsx
git commit -m "feat(form-builder-ui): render CheckboxGroup/TagList + honor description/disabled/readOnly"
```

---

### Task 5: form-designer 收新元件 + inspector + palette(單一原子任務)

**Files:**
- Modify: `apps/web/src/tools/form-designer/model.ts`
- Modify: `apps/web/src/tools/form-designer/inspector/settings-panel.tsx`
- Modify: `apps/web/src/tools/form-designer/ui.tsx`
- Test: `apps/web/src/tools/form-designer/model.spec.ts`(若無則建立)

**Interfaces:**
- Consumes: Task 1 的 `FieldComponent`/`FieldConfig`。
- Produces: 畫布 `Component` = 引擎完整 `FieldComponent` union(含 `Date`/`Email`/`Radio`/`Checkbox` + `CheckboxGroup`/`TagList`);`componentDataType` 回 `FieldType`(含 `array`/`object`);`formConfigToCards`/`cardToItem` 帶 `description`/`disabled`/`readOnly`;不再正規化成 Input。

- [ ] **Step 1: 寫失敗測試**

```ts
import { formConfigToCards, cardsToFormConfig } from "./model";

it("round-trips CheckboxGroup/Radio/Date + description/disabled/readOnly without losing data", () => {
  const cfg = { sections: [{ id: "s", title: "S", rows: [{ id: "r", items: [
    { key: "g", label: "G", component: "CheckboxGroup", options: [{ label: "A", value: "a" }], description: "d", readOnly: true },
    { key: "d", label: "D", component: "Date" },
  ] }] }] };
  const back = cardsToFormConfig(formConfigToCards(cfg as any));
  const item0 = back.sections[0].rows[0].items[0];
  expect(item0.component).toBe("CheckboxGroup"); // 不再變成 Input
  expect(item0.description).toBe("d");
  expect(item0.readOnly).toBe(true);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-designer/model.spec.ts`
Expected: FAIL(Date/CheckboxGroup 被正規化成 Input;description/readOnly 被丟掉)。

- [ ] **Step 3: 實作 model.ts**

- `Component` 改成引擎完整 union(直接 re-use `FieldComponent`,或列全)。
- `DATATYPE` 改成 `Record<Component, FieldType>`(Date→`date`、Email→`string`、Number→`number`、Switch/Checkbox→`boolean`、CheckboxGroup/TagList→`array`、其餘 string),`componentDataType` 回 `FieldType`。
- 移除第 122–123 行 normalize-to-Input,改為直接採用 `item.component`。
- `cardToItem`/`formConfigToCards` 帶 `description`/`disabled`/`readOnly`/`creatable`/`options`。

- [ ] **Step 4: 實作 settings-panel.tsx + ui.tsx**

- settings-panel:Basics 加 `description`(i18n,納入 LabelsSection)、`disabled`、`readOnly` 控制項。把 `component === "Select"` 的判斷改成集合:`OPTIONS_COMPONENTS = new Set(["Select","Radio","CheckboxGroup","TagList"])`、`DATASOURCE_COMPONENTS = new Set(["Select","Radio","CheckboxGroup","TagList"])`。
- ui.tsx:palette 工具列加入新元件(Radio/Checkbox/CheckboxGroup/TagList/Date/Email)。

- [ ] **Step 5: 跑測試 + 型別**

Run: `pnpm -F web vitest:run src/tools/form-designer && pnpm -F web check-types`
Expected: PASS、type-check exit 0。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/form-designer/
git commit -m "feat(web): surface full component set + new field props in form-designer"
```

---

## Batch F1-rich — FileUpload + Signature

### Task 6: 引擎 FileUpload/Signature 型別 + schema + zod

**Files:**
- Modify: `packages/form-builder/src/types.ts`
- Modify: `packages/form-builder/src/config-schema.ts`
- Modify: `packages/form-builder/src/config-to-zod.ts`
- Test: `packages/form-builder/src/config-schema.spec.ts`、`config-to-zod.spec.ts`

**Interfaces:**
- Produces:
  - `FieldComponent += 'FileUpload' | 'Signature'`。
  - `FieldConfig.fileUpload?: { accept?: string; multiple?: boolean; maxSize?: number }`。
  - `types.ts` 匯出 `FileRef`、`UploadHandler`、`SignatureCaptureHandle`、`SignatureTransport`(見 spec §4 的型別定義,逐字採用)。
  - zod:FileUpload 單檔 dataType `object`、多檔 `array`、required → 存在/`.min(1)`;Signature dataType `string`、required → `.min(1)`。

- [ ] **Step 1: 寫失敗測試**

```ts
it("accepts FileUpload with fileUpload config and Signature", () => {
  expect(fieldConfigSchema.safeParse({ key: "f", label: "F", component: "FileUpload",
    fileUpload: { accept: "image/*", multiple: true, maxSize: 5_000_000 } }).success).toBe(true);
  expect(fieldConfigSchema.safeParse({ key: "s", label: "S", component: "Signature" }).success).toBe(true);
});

it("required Signature rejects empty string", () => {
  const schema = configToZod(mkConfig({ key: "s", component: "Signature", required: true }));
  expect(schema.safeParse({ s: "" }).success).toBe(false);
  expect(schema.safeParse({ s: "data:image/png;base64,xxx" }).success).toBe(true);
});

it("required multiple FileUpload rejects empty array", () => {
  const schema = configToZod(mkConfig({ key: "f", component: "FileUpload", required: true,
    fileUpload: { multiple: true } }));
  expect(schema.safeParse({ f: [] }).success).toBe(false);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts src/config-to-zod.spec.ts`
Expected: FAIL。

- [ ] **Step 3: 實作**

- types.ts:union 加兩個元件;加 `fileUpload` 屬性;加入 spec §4 的 `FileRef`/`UploadHandler`/`SignatureCaptureHandle`/`SignatureTransport` 並在 `index.ts` re-export。
- config-schema.ts:component enum 加兩個;`fileUpload` 子 schema `z.object({ accept: z.string().optional(), multiple: z.boolean().optional(), maxSize: z.number().optional() }).optional()`。
- config-to-zod.ts:Signature → `z.string()`(required `.min(1)`);FileUpload → 多檔 `z.array(z.unknown())`(required `.min(1)`)、單檔 `z.unknown()`(required → 存在性)。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder vitest:run`
Expected: PASS(全包)。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder/src/
git commit -m "feat(form-builder): add FileUpload/Signature components, FileRef + handler types"
```

---

### Task 7: web-ui `<SignaturePad>` + jsdom canvas stub

**Files:**
- Create: `packages/web-ui/src/components/signature-pad.tsx`
- Create: `packages/web-ui/src/components/signature-pad.spec.tsx`
- Modify: `packages/web-ui/src/index.ts`
- Modify: `packages/web-ui/vitest.setup.ts`(加 `getContext` stub)
- Modify: `packages/web-ui/package.json`(加 `signature_pad` 依賴)

**Interfaces:**
- Produces:
```ts
export interface SignaturePadProps {
  value?: string;                 // data URL(受控)
  onChange?: (dataUrl: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  penColor?: string;
  height?: number;
}
export function SignaturePad(props: SignaturePadProps): JSX.Element;
```

- [ ] **Step 1: 加 canvas stub(否則 jsdom 會丟錯)**

在 `vitest.setup.ts` 仿既有 `ResizeObserver`/`scrollIntoView` stub 加:
```ts
if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = (() => ({
    // 最小 2d context stub(signature_pad constructor 需要)
    fillRect: () => {}, clearRect: () => {}, beginPath: () => {}, moveTo: () => {},
    lineTo: () => {}, stroke: () => {}, fill: () => {}, arc: () => {}, closePath: () => {},
    save: () => {}, restore: () => {}, translate: () => {}, scale: () => {},
    canvas: document.createElement("canvas"),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,stub";
```

- [ ] **Step 2: 寫失敗測試**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignaturePad } from "./signature-pad";

it("renders a canvas and a clear button", () => {
  render(<SignaturePad />);
  expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
});

it("clear empties and calls onClear", async () => {
  const onClear = vi.fn();
  render(<SignaturePad onClear={onClear} />);
  await userEvent.click(screen.getByRole("button", { name: /clear/i }));
  expect(onClear).toHaveBeenCalled();
});

it("disabled hides/disables the clear control", () => {
  render(<SignaturePad disabled />);
  expect(screen.getByRole("button", { name: /clear/i })).toBeDisabled();
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F @rfjs/web-ui vitest:run src/components/signature-pad.spec.tsx`
Expected: FAIL(模組不存在)。

- [ ] **Step 4: 加依賴 + 實作**

- `package.json` `dependencies` 加 `"signature_pad": "^5.0.0"`,然後 `pnpm install`。
- signature-pad.tsx:`useEffect` 內 `new SignaturePad(canvasRef.current, { penColor })`(client-only);resize 時依 `devicePixelRatio` 設定 canvas 寬高與 `getContext("2d").scale`;`endStroke` 事件呼叫 `onChange(pad.toDataURL())`;Clear 鈕呼叫 `pad.clear()` + `onChange("")` + `onClear?.()`;受控 `value`:當 `value` 為空字串時 `pad.clear()`。`disabled` 時 `pad.off()` 並停用 Clear。unmount 時 `pad.off()`。

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F @rfjs/web-ui vitest:run src/components/signature-pad.spec.tsx`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add packages/web-ui/src/components/signature-pad.tsx packages/web-ui/src/components/signature-pad.spec.tsx packages/web-ui/src/index.ts packages/web-ui/vitest.setup.ts packages/web-ui/package.json pnpm-lock.yaml
git commit -m "feat(web-ui): add SignaturePad wrapping signature_pad + jsdom canvas stub"
```

---

### Task 8: Renderer FileUpload/Signature + use-signature-capture + prop 串接

**Files:**
- Create: `packages/form-builder-ui/src/use-signature-capture.ts`
- Create: `packages/form-builder-ui/src/use-signature-capture.spec.ts`
- Modify: `packages/form-builder-ui/src/field-control.tsx`
- Modify: `packages/form-builder-ui/src/config-form.tsx`
- Modify: `packages/form-builder-ui/src/config-form-builder.tsx`
- Test: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes: Task 6 的 `UploadHandler`/`SignatureTransport`/`SignatureCaptureHandle`/`FileRef`、Task 7 的 `<SignaturePad>`。
- Produces:
  - `ConfigForm` props 加 `uploadHandler?: UploadHandler`、`signatureTransport?: SignatureTransport`;`ConfigFormBuilderProps` 同樣加並轉發給預覽 `ConfigForm`。
  - `useSignatureCapture(transport?, fieldKey)`:回 `{ status, value, start(), cancel() }`,unmount 拆除;`pending` 時送出鈕停用。
  - FileUpload:無 `uploadHandler` → 顯示停用 fallback;有 → 選檔(超過 `maxSize` 在挑檔當下擋下並顯示訊息)→ `uploadHandler(file)` → 值存 `FileRef`(多檔為 `FileRef[]`)。

- [ ] **Step 1: 寫失敗測試**

```ts
// use-signature-capture.spec.ts
it("local-less transport stays idle; provided transport resolves to value", async () => {
  const handle = { result: Promise.resolve("data:image/png;base64,xx"), cancel: vi.fn() };
  const transport = vi.fn(() => handle);
  // renderHook(useSignatureCapture(transport,"sig")) → start() → status pending→ready, value 設定
});
```
```tsx
// config-form.spec.tsx
it("FileUpload without uploadHandler shows a disabled fallback", () => { /* render → 出現 fallback 文案、input disabled */ });
it("FileUpload stores FileRef from uploadHandler", async () => {
  const uploadHandler = vi.fn(async (f: File) => ({ name: f.name, size: f.size, type: f.type, url: "u" }));
  // 選檔 → 表單值 = { name, size, type, url:"u" }
});
it("rejects a file over maxSize at pick time", async () => { /* 選超過 maxSize 的檔 → 出現錯誤訊息、值不變 */ });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/use-signature-capture.spec.ts src/config-form.spec.tsx`
Expected: FAIL。

- [ ] **Step 3: 實作 use-signature-capture.ts**

仿 `use-data-source.ts` 的 `active` 旗標模式:`start()` 呼叫 `transport({ fieldKey, signal })`,訂閱 `subscribe`(若有)更新 `status`;`result` resolve 後設 `value`、`status='ready'`;unmount/`cancel()` 呼叫 `handle.cancel()` 並 abort。預設(無 transport)由 SignaturePad 直接驅動 `onChange`,此 hook 對本地維持 `idle`。

- [ ] **Step 4: 實作 field-control.tsx**

- `case "Signature"`:渲染 `<SignaturePad value onChange disabled={disabled||readOnly} penColor>`;接 RHF。
- `case "FileUpload"`:無 `uploadHandler` → 停用 fallback(訊息 + disabled input);有 → `<input type="file" accept={fileUpload.accept} multiple={fileUpload.multiple}>`,`onChange` 時對每個 file 檢查 `maxSize`(bytes,超過設錯誤訊息、略過),通過者 `await uploadHandler(file)`,把 `FileRef`(多檔陣列)寫回 RHF。

- [ ] **Step 5: 串 props(config-form.tsx / config-form-builder.tsx)**

`ConfigForm` 接 `uploadHandler`/`signatureTransport` 並下傳給 `FieldControl`;`ConfigFormBuilder` 接同名 props 轉發給其預覽 `ConfigForm`。送出鈕:`useSignatureCapture` `pending` 時 `disabled`。JSDoc 比照 `fetcher`(提醒 `useCallback` 記憶化;說明 absence 語意:fetcher/uploadHandler 降級、signatureTransport fallback 到本地)。

- [ ] **Step 6: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: PASS(全包)。

- [ ] **Step 7: Commit**

```bash
git add packages/form-builder-ui/src/
git commit -m "feat(form-builder-ui): render FileUpload/Signature, inject uploadHandler/signatureTransport seams"
```

---

### Task 9: form-designer FileUpload/Signature inspector + palette + 預覽注入

**Files:**
- Modify: `apps/web/src/tools/form-designer/model.ts`
- Modify: `apps/web/src/tools/form-designer/inspector/settings-panel.tsx`
- Modify: `apps/web/src/tools/form-designer/ui.tsx`
- Modify: `apps/web/src/tools/form-builder/sample.ts`(擴 mock uploader)
- Test: `apps/web/src/tools/form-designer/model.spec.ts`

**Interfaces:**
- Consumes: Task 6 的元件/型別、Task 8 的 `uploadHandler` prop。
- Produces:畫布支援 FileUpload/Signature;inspector 有 FileUpload 區塊(accept/multiple/maxSize)與 Signature 區塊(penColor);預覽 `<ConfigForm>` 注入 mock `uploadHandler`。

- [ ] **Step 1: 寫失敗測試**

```ts
it("round-trips FileUpload config (accept/multiple/maxSize) and Signature", () => {
  const cfg = { sections: [{ id: "s", title: "S", rows: [{ id: "r", items: [
    { key: "f", label: "F", component: "FileUpload", fileUpload: { accept: "image/*", multiple: true, maxSize: 1000 } },
    { key: "s", label: "S", component: "Signature" },
  ] }] }] };
  const back = cardsToFormConfig(formConfigToCards(cfg as any));
  const f = back.sections[0].rows[0].items[0];
  expect(f.component).toBe("FileUpload");
  expect(f.fileUpload).toEqual({ accept: "image/*", multiple: true, maxSize: 1000 });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-designer/model.spec.ts`
Expected: FAIL(fileUpload 未被帶過)。

- [ ] **Step 3: 實作**

- model.ts:`cardToItem`/`formConfigToCards` 帶 `fileUpload`;`Component`/`DATATYPE` 已於 Task 5 擴(此處確認 FileUpload→object/array、Signature→string 已涵蓋)。
- settings-panel.tsx:加 FileUpload 區塊(accept 字串、multiple 開關、maxSize 數字 — 標示單位 bytes)、Signature 區塊(penColor)。
- ui.tsx:palette 加 FileUpload/Signature;預覽 `<ConfigForm>` 加 `uploadHandler={sampleUploader}`。
- sample.ts:加 `sampleUploader: UploadHandler`(回傳 mock `FileRef`,例如 `{ name, size, type, url: URL.createObjectURL(file) }`)。

- [ ] **Step 4: 跑測試 + 型別**

Run: `pnpm -F web vitest:run src/tools/form-designer && pnpm -F web check-types`
Expected: PASS、exit 0。

- [ ] **Step 5: 瀏覽器檢查(截圖)**

啟動 `pnpm --filter web exec next dev -p 3360`,開 `/en/tools/form-designer`,放一個 Signature 與 FileUpload 元件,截圖確認可手寫、可選檔。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tools/form-designer/ apps/web/src/tools/form-builder/sample.ts
git commit -m "feat(web): FileUpload/Signature in form-designer inspector, palette, and preview"
```

---

## 收尾

- [ ] 全量回歸:`pnpm -F @rfjs/form-builder vitest:run && pnpm -F @rfjs/web-ui vitest:run && pnpm -F @rfjs/form-builder-ui vitest:run && pnpm -F web vitest:run src/tools/form-designer && pnpm -F web check-types`
- [ ] 開 PR(英文)。標題:`feat(form-designer): rich inputs — CheckboxGroup/TagList/FileUpload/Signature + field props`。內文連結本 spec/plan、列出兩批次與 ws/wss 接縫說明。**等使用者輸入「merged」再合併。**

## Self-Review 對照(spec → task)

- §2 F1 元件(CheckboxGroup/TagList)→ Task 1/2/4/5;Radio/Checkbox 露出 → Task 5。✅
- §2 屬性(description/disabled/readOnly)→ Task 1/4/5。✅
- §2 F1-rich(FileUpload/Signature)→ Task 6/7/8/9。✅
- §3 接縫(uploadHandler/signatureTransport,不進 FormConfig)→ Task 8。✅
- §4 值契約/型別 → Task 6。✅
- §5 config-to-zod 地雷 → Task 2(+ Task 6 的 FileUpload/Signature)。✅
- §6 form-designer model/inspector/palette → Task 5/9。✅
- §7 renderer + readOnly 跨切面 → Task 4/8。✅
- §8 web-ui SignaturePad/TagInput + getContext stub → Task 3/7。✅
- §9 ws/wss 接縫(async+cancelable + submit gating)→ Task 6 型別 + Task 8 hook。✅
- §11 延後項擴充點:不寫 code,僅在 spec 記錄;計劃不引入會堵死的硬寫死。✅
- §12 測試:各 Task 的 TDD 步驟 + 收尾全量回歸 + Task 9 截圖。✅
