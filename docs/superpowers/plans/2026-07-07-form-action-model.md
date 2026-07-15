# form-builder 動作/按鈕模型 — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** form-builder 新增可配置按鈕(item kind `button`,動作 submit/reset/clear/custom/api)+ 統一 `{ data, meta }` 信封 + builder 配置 UI。

**Architecture:** engine(`@rfjs/form-builder`)只加型別與 zod schema;renderer(`@rfjs/form-builder-ui` ConfigForm)負責渲染按鈕與執行動作;工具(apps/web form-builder)加 palette 卡/inspector 面板/SubmissionPanel 顯示。規格見 `docs/superpowers/specs/2026-07-07-form-action-model-design.md`(**每個任務開工前先讀 spec 對應章節**)。

**Tech Stack:** zod v4、react-hook-form + zodResolver、Next.js(apps/web)、vitest + testing-library、Playwright e2e(port 3002)。

## Global Constraints

- 工作目錄:worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-form-actions`,分支 `feat-form-actions`。
- Commit:英文 conventional commits,subject 全小寫開頭,結尾附 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- **Changeset 規則**:`@rfjs/form-builder` **minor**(可發布,會上 npm)、`@rfjs/form-builder-ui` **minor**(private,version-only);apps/web 不寫。changeset 檔用手寫 markdown(`.changeset/<slug>.md`),不跑互動 CLI。
- 測試指令:`pnpm -F @rfjs/form-builder vitest:run`、`pnpm -F @rfjs/form-builder-ui vitest:run`、`pnpm -F web vitest:run <path>`(worktree 根執行)。
- **form-builder-ui 是 transpilePackages 原始碼直接消費** —— 改 engine 後 apps/web 的型別檢查要先 `pnpm build:packages`(engine 走 dist)。
- 相容底線:FormConfig 無 button item 時,ConfigForm 行為與現在一致(尾端預設 Submit);既有測試除 onSubmit 信封簽名外不得因此變動語義。
- Breaking(已裁決):`onSubmit` 簽名 `(values) => void` → `({ data, meta }) => void`;現有呼叫端都是 `onSubmit={() => {}}`(no-op,型別相容),不需連動修改。
- inspector/palette 文案沿用既有慣例(硬編英文,與 settings-panel/KIND_META 一致);範例按鈕 label 用 LocalizedLabel(en + zh-TW)。
- web-ui Button variants:`default | destructive | outline | secondary | ghost | link`;engine `variant: 'primary'` 對映 web-ui `'default'`。

---

### Task 1: Engine — ButtonItem/ButtonAction 型別 + zod schema + changeset

**Files:**
- Modify: `packages/form-builder/src/types.ts`(ItemKind:84、FormItem:103、FormConfig:125、DataSourceRequest:7)
- Modify: `packages/form-builder/src/config-schema.ts`(formItemSchema:143、FormConfigSchema:170)
- Modify: `packages/form-builder/src/config-schema.spec.ts`(追加)
- Create: `.changeset/form-action-model-engine.md`

**Interfaces:**
- Produces(後續任務全依賴):
  - `type ButtonActionType = 'submit' | 'reset' | 'clear' | 'custom' | 'api'`
  - `type ButtonAction`(discriminated union on `type`,見下)
  - `interface ButtonItem { id: string; kind: 'button'; label: LocalizedLabel; action: ButtonAction; variant?: 'primary'|'outline'|'ghost'|'destructive'; validate?: boolean }`
  - `FormConfig` 新增 `id?: string`、`meta?: Record<string, unknown>`
  - `DataSourceRequest.method` 聯集加 `'PATCH'`

- [ ] **Step 1: 寫失敗測試** — `config-schema.spec.ts` 追加:

```ts
describe('button items', () => {
  const base = { version: 1, sections: [{ id: 's1', rows: [{ id: 'r1', items: [] as unknown[] }] }] };
  const withItem = (item: unknown) => ({ ...base, sections: [{ id: 's1', rows: [{ id: 'r1', items: [item] }] }] });

  it('accepts each action variant', () => {
    const actions = [
      { type: 'submit' },
      { type: 'reset' },
      { type: 'clear', fields: ['a'] },
      { type: 'custom', name: 'save-draft' },
      { type: 'api', url: '/x', method: 'PATCH', fields: ['a'], responseMap: { 'r.total': 'total' }, messages: { success: 'ok', error: { en: 'no', 'zh-TW': '失敗' } } },
    ];
    for (const action of actions) {
      const r = formConfigSchema.safeParse(withItem({ id: 'b1', kind: 'button', label: 'Go', action }));
      expect(r.success, JSON.stringify(action)).toBe(true);
    }
  });

  it('rejects invalid buttons: clear w/o fields, custom empty name, api w/o url, unknown type', () => {
    const bad = [
      { type: 'clear', fields: [] },
      { type: 'custom', name: '' },
      { type: 'api' },
      { type: 'nope' },
    ];
    for (const action of bad) {
      const r = formConfigSchema.safeParse(withItem({ id: 'b1', kind: 'button', label: 'Go', action }));
      expect(r.success, JSON.stringify(action)).toBe(false);
    }
  });

  it('accepts optional variant/validate and top-level id/meta', () => {
    const cfg = {
      ...withItem({ id: 'b1', kind: 'button', label: 'Go', action: { type: 'submit' }, variant: 'outline', validate: false }),
      id: 'leave-form',
      meta: { source: 'web' },
    };
    const r = formConfigSchema.safeParse(cfg);
    expect(r.success).toBe(true);
  });
});
```

（`formConfigSchema` 已由該 spec 檔既有 import 取得;若無則補 import。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts`
Expected: FAIL —— button kind 不在 discriminated union。

- [ ] **Step 3: 實作**

`types.ts` —— `DataSourceRequest.method`(第 9 行)改為 `'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`;`ItemKind`(84)改:

```ts
export type ItemKind = 'field' | 'content' | 'divider' | 'spacer' | 'ai-note' | 'button';
```

`AiNoteItem`(102)之後、`FormItem`(103)之前插入:

```ts
export type ButtonActionType = 'submit' | 'reset' | 'clear' | 'custom' | 'api';

export type ButtonAction =
  | { type: 'submit' }
  | { type: 'reset' }
  | { type: 'clear'; fields: string[] }
  | { type: 'custom'; name: string }
  | {
      type: 'api';
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';   // default POST
      fields?: string[];                                       // omit = all visible fields
      responseMap?: Record<string, string>;                    // response dot-path → target field key
      messages?: { success?: LocalizedLabel; error?: LocalizedLabel };
    };

export interface ButtonItem {
  id: string;
  kind: 'button';
  label: LocalizedLabel;
  action: ButtonAction;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';   // default: submit→primary, others→outline
  validate?: boolean;   // default: submit→true, api/custom→false; ignored for reset/clear
}
```

`FormItem` 聯集加 `| ButtonItem`;`FormConfig` 加:

```ts
export interface FormConfig {
  version: number;
  id?: string;                        // → ActionMeta.formId
  meta?: Record<string, unknown>;     // → ActionMeta.custom
  fields?: FieldConfig[];
  sections?: FormSection[];
  columns?: 1 | 2 | 3 | 4;
  responsive?: { stackBelow?: number };
}
```

`config-schema.ts` —— 在 `aiNoteItemSchema`(137)之後加(`localizedLabelSchema`:檔內已有給 label 用的 union schema 就複用;若無,補 `const localizedLabelSchema = z.union([z.string(), z.record(z.string(), z.string())]);`):

```ts
const buttonActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('submit') }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('clear'), fields: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal('custom'), name: z.string().min(1) }),
  z.object({
    type: z.literal('api'),
    url: z.string().min(1),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
    fields: z.array(z.string().min(1)).optional(),
    responseMap: z.record(z.string(), z.string()).optional(),
    messages: z.object({ success: localizedLabelSchema.optional(), error: localizedLabelSchema.optional() }).optional(),
  }),
]);

const buttonItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('button'),
  label: localizedLabelSchema,
  action: buttonActionSchema,
  variant: z.enum(['primary', 'outline', 'ghost', 'destructive']).optional(),
  validate: z.boolean().optional(),
});
```

`formItemSchema` 的 discriminatedUnion 陣列加入 `buttonItemSchema`;`FormConfigSchema`(170)物件加 `id: z.string().min(1).optional()` 與 `meta: z.record(z.string(), z.unknown()).optional()`。DataSource 的 zod method enum(`config-schema.ts` 內 dataSourceSchema.request)同步加 `'PATCH'`。

`.changeset/form-action-model-engine.md`:

```md
---
"@rfjs/form-builder": minor
---

Add configurable button items: `ButtonItem` (`kind: 'button'`) with a `ButtonAction` union (`submit` / `reset` / `clear` / `custom` / `api`), plus optional top-level `FormConfig.id` and `FormConfig.meta` for the action payload envelope. `DataSourceRequest.method` now also accepts `PATCH`.
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder vitest:run && pnpm -F @rfjs/form-builder typecheck`
Expected: 全 PASS(既有測試不受影響)。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts .changeset/form-action-model-engine.md
git commit -m "feat(form-builder): add button item and action union to config model

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Renderer — ActionMeta 信封 + onSubmit 簽名 + metaProvider + changeset

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`(SubmissionMeta:30、ConfigFormProps:77、handleSubmit:338)
- Modify: `packages/form-builder-ui/src/config-form.spec.tsx`(既有 onSubmit 斷言改信封 + 新測試)
- Create: `.changeset/form-action-model-ui.md`

**Interfaces:**
- Consumes: Task 1 的 `ButtonActionType`、`FormConfig.id/meta`。
- Produces(Task 3/4/7 依賴):
  - `interface ActionMeta extends SubmissionMeta { formId?: string; timestamp: string; action: { type: ButtonActionType; name?: string }; custom?: Record<string, unknown>; apiError?: string; [key: string]: unknown }`
  - `ConfigFormProps.onSubmit: (payload: { data: Record<string, unknown>; meta: ActionMeta }) => void`
  - `ConfigFormProps.metaProvider?: () => Record<string, unknown>`
  - `ConfigFormProps.onAction?: (name: string, payload: { data: Record<string, unknown>; meta: ActionMeta; response?: unknown }) => void`(本任務先宣告型別,行為 Task 3/4 實作)
  - 內部 helper `buildActionMeta`(export 供測試)

- [ ] **Step 1: 寫失敗測試** — `config-form.spec.tsx` 追加(既有 submit 測試若斷言 `onSubmit` 收到裸 values,改成解構 `payload.data` 斷言,語義不變):

```tsx
describe('action meta envelope', () => {
  const cfg: FormConfig = {
    version: 1,
    id: 'leave-form',
    meta: { source: 'web' },
    fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }],
  };

  it('default submit emits { data, meta } with formId/timestamp/action/custom', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={cfg} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Roy' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]![0] as { data: Record<string, unknown>; meta: Record<string, unknown> };
    expect(payload.data).toEqual({ name: 'Roy' });
    expect(payload.meta).toMatchObject({
      formId: 'leave-form',
      action: { type: 'submit' },
      custom: { source: 'web' },
      valid: true,
      schemaVersion: 1,
    });
    expect(typeof payload.meta.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(payload.meta.timestamp as string))).toBe(false);
  });

  it('metaProvider values merge in but cannot override reserved keys', async () => {
    const onSubmit = vi.fn();
    render(
      <ConfigForm
        config={cfg}
        onSubmit={onSubmit}
        metaProvider={() => ({ user: 'roy', action: 'HACKED', timestamp: 'HACKED' })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const meta = onSubmit.mock.calls[0]![0].meta as Record<string, unknown>;
    expect(meta.user).toBe('roy');
    expect(meta.action).toEqual({ type: 'submit' });   // 保留鍵未被覆蓋
    expect(meta.timestamp).not.toBe('HACKED');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL —— payload 仍是裸 values。

- [ ] **Step 3: 實作** — `config-form.tsx`:

`SubmissionMeta` 之後加:

```ts
import type { ButtonActionType } from '@rfjs/form-builder';

export interface ActionMeta extends SubmissionMeta {
  /** FormConfig.id (when set). */
  formId?: string;
  /** ISO timestamp at the moment the action fired. */
  timestamp: string;
  /** Which action fired (name only for `custom`). */
  action: { type: ButtonActionType; name?: string };
  /** FormConfig.meta, passed through verbatim. */
  custom?: Record<string, unknown>;
  /** Set when an `api` action's fetcher rejected. */
  apiError?: string;
  /** metaProvider-injected runtime keys. */
  [key: string]: unknown;
}

/** Builds the meta envelope for an action. Reserved keys always win over metaProvider output. */
export function buildActionMeta(opts: {
  config: FormConfig;
  data: Record<string, unknown>;
  action: { type: ButtonActionType; name?: string };
  metaProvider?: () => Record<string, unknown>;
}): ActionMeta {
  const { config, data, action, metaProvider } = opts;
  const visibleFieldItems = collectFieldItems(config).filter((f) => evaluateConditional(f.conditional, data));
  const parsed = configToZod({ version: config.version, fields: visibleFieldItems }).safeParse(data);
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0]);
      if (k && !errors[k]) errors[k] = issue.message;
    }
  }
  return {
    ...(metaProvider ? metaProvider() : {}),
    valid: parsed.success,
    errors,
    visibleKeys: Object.keys(data),
    schemaVersion: config.version,
    ...(config.id !== undefined ? { formId: config.id } : {}),
    timestamp: new Date().toISOString(),
    action,
    ...(config.meta !== undefined ? { custom: config.meta } : {}),
  };
}
```

`ConfigFormProps`:`onSubmit` 型別改 `(payload: { data: Record<string, unknown>; meta: ActionMeta }) => void`;加 `metaProvider?: () => Record<string, unknown>;` 與 `onAction?: (name: string, payload: { data: Record<string, unknown>; meta: ActionMeta; response?: unknown }) => void;`(JSDoc 各一句)。函式簽名解構加 `metaProvider, onAction`。

`handleSubmit` callback(338)改:

```tsx
onSubmit={handleSubmit((all) => {
  const data = computePayload(all as Record<string, unknown>, config);
  onSubmit({ data, meta: buildActionMeta({ config, data, action: { type: 'submit' }, metaProvider }) });
})}
```

（`onPayloadChange` 的既有 effect 邏輯與 `buildActionMeta` 有部分重複 —— 允許該 effect 內改用 `buildActionMeta` 的 valid/errors 計算段抽共用,但 `onPayloadChange` 的對外型別維持 `SubmissionMeta` 不變。）

`.changeset/form-action-model-ui.md`:

```md
---
"@rfjs/form-builder-ui": minor
---

ConfigForm renders configurable button items and emits a unified `{ data, meta: ActionMeta }` envelope for submit/custom/api actions (breaking: `onSubmit` now receives the envelope instead of bare values). New props: `onAction`, `metaProvider`.
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run && pnpm -F @rfjs/form-builder-ui typecheck`
Expected: 全 PASS(既有 submit 相關測試已同步改信封斷言)。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx .changeset/form-action-model-ui.md
git commit -m "feat(form-builder-ui): emit { data, meta } action envelope from configform submit

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Renderer — 按鈕渲染 + submit/reset/clear/custom 動作

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`(renderItem:236、預設 Submit 區:409)
- Modify: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes: Task 1 `ButtonItem`;Task 2 `buildActionMeta`/`onAction`/`metaProvider`。
- Produces: 按鈕渲染與動作分發(Task 4 的 api 分支掛在同一個 `runAction`;Task 5-7 的工具層依賴此行為)。

- [ ] **Step 1: 寫失敗測試** — `config-form.spec.tsx` 追加:

```tsx
describe('button items', () => {
  const btn = (action: ButtonAction, extra?: Partial<ButtonItem>): FormConfig => ({
    version: 1,
    sections: [{
      id: 's1',
      rows: [{
        id: 'r1',
        items: [
          { id: 'f1', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
          { id: 'f2', kind: 'field', key: 'note', label: 'Note', component: 'Input', dataType: 'string', defaultValue: 'keep' },
          { id: 'b1', kind: 'button', label: 'Go', action, ...extra },
        ],
      }],
    }],
  });

  it('renders configured buttons and suppresses the default submit', () => {
    render(<ConfigForm config={btn({ type: 'custom', name: 'x' })} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^submit$/i })).toBeNull();
  });

  it('submit button validates by default and blocks invalid submit', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={btn({ type: 'submit' })} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(screen.getByText(/required|expected|invalid/i)).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submit button with valid values emits the envelope with action.type submit', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={btn({ type: 'submit' })} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Roy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].meta.action).toEqual({ type: 'submit' });
  });

  it('custom button skips validation by default and calls onAction with the envelope', async () => {
    const onAction = vi.fn();
    render(<ConfigForm config={btn({ type: 'custom', name: 'save-draft' })} onSubmit={vi.fn()} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));   // name 空著也能發(不驗)
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    const [name, payload] = onAction.mock.calls[0]!;
    expect(name).toBe('save-draft');
    expect(payload.meta.action).toEqual({ type: 'custom', name: 'save-draft' });
    expect(payload.meta.valid).toBe(false);   // meta 照實回報
  });

  it('custom button with validate: true blocks when invalid', async () => {
    const onAction = vi.fn();
    render(<ConfigForm config={btn({ type: 'custom', name: 'x' }, { validate: true })} onSubmit={vi.fn()} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(screen.getByText(/required|expected|invalid/i)).toBeTruthy());
    expect(onAction).not.toHaveBeenCalled();
  });

  it('clear resets only the listed fields', async () => {
    render(<ConfigForm config={btn({ type: 'clear', fields: ['name'] })} onSubmit={vi.fn()} defaultValues={{ name: 'Roy', note: 'keep' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('keep');
  });

  it('reset restores defaultValues', async () => {
    render(<ConfigForm config={btn({ type: 'reset' })} onSubmit={vi.fn()} defaultValues={{ name: 'init', note: 'keep' }} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('init'));
  });
});
```

（`ButtonAction`/`ButtonItem` 型別 import 自 `@rfjs/form-builder`。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL —— button item 不渲染(renderItem 無此分支)且預設 Submit 仍在。

- [ ] **Step 3: 實作** — `config-form.tsx`:

useForm 解構補 `trigger, getValues, setValue`。加 variant 對映與動作執行器(元件內,`renderItem` 之前):

```tsx
const BUTTON_VARIANT: Record<NonNullable<ButtonItem['variant']>, 'default' | 'outline' | 'ghost' | 'destructive'> = {
  primary: 'default',
  outline: 'outline',
  ghost: 'ghost',
  destructive: 'destructive',
};
// 文字類元件 clear 後給 "",其餘 undefined(受控 input 需要字串空值)。
const TEXT_COMPONENTS = new Set(['Input', 'Textarea', 'Email']);

async function runAction(item: ButtonItem) {
  const { action } = item;
  if (action.type === 'reset') {
    reset(defaultValues ?? {});
    return;
  }
  if (action.type === 'clear') {
    const byKey = new Map(collectFieldItems(config).map((f) => [f.key, f]));
    for (const key of action.fields) {
      const comp = byKey.get(key)?.component ?? 'Input';
      setValue(key, TEXT_COMPONENTS.has(comp) ? '' : undefined, { shouldDirty: true });
    }
    return;
  }
  const doValidate = item.validate ?? (action.type === 'submit');
  if (doValidate) {
    const ok = await trigger();
    if (!ok) return;   // RHF 顯示欄位錯誤,動作不發
  }
  const data = computePayload(getValues() as Record<string, unknown>, config);
  if (action.type === 'submit') {
    onSubmit({ data, meta: buildActionMeta({ config, data, action: { type: 'submit' }, metaProvider }) });
    return;
  }
  if (action.type === 'custom') {
    onAction?.(action.name, {
      data,
      meta: buildActionMeta({ config, data, action: { type: 'custom', name: action.name }, metaProvider }),
    });
    return;
  }
  // action.type === 'api' — Task 4
}
```

`renderItem` 加分支(`content` 分支之後、field 之前):

```tsx
if (item.kind === 'button') {
  const variant = BUTTON_VARIANT[item.variant ?? (item.action.type === 'submit' ? 'primary' : 'outline')];
  return (
    <div key={item.id} data-item={item.id} className="flex min-w-0 items-end" style={place ? placementStyle(place) : fieldSpanStyle(undefined, flow, cols)}>
      <Button type="button" variant={variant} disabled={pendingCaptures.size > 0} onClick={() => void runAction(item)}>
        {resolveLabel(item.label, locale)}
      </Button>
    </div>
  );
}
```

預設 Submit 區(409)改成僅在無任何 button item 時渲染:

```tsx
const hasButtons = React.useMemo(
  () => normalizeToSections(config).some((s) => s.rows.some((r) => r.items.some((i) => i.kind === 'button'))),
  [config],
);
```

```tsx
{!hasButtons && (
  <div style={{ gridColumn: '1 / -1' }}>
    <Button type="submit" disabled={pendingCaptures.size > 0} className="self-start border-0 text-white" style={{ background: 'linear-gradient(180deg,#5b8cff,#4a78ee)', boxShadow: '0 6px 16px rgba(74,120,238,.3)' }}>
      {submitLabel}
    </Button>
  </div>
)}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "feat(form-builder-ui): render button items with submit/reset/clear/custom actions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Renderer — api 動作(fetcher/pending/訊息/responseMap)

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`
- Modify: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes: Task 3 的 `runAction`(補 api 分支)、既有 `fetcher?: DataSourceFetcher`。
- Produces: api 行為契約(Task 7 preview echo fetcher 依賴):fetcher 收 `{ url, method(預設 'POST'), body: { data, meta } }`;成功 `onAction('api', { data, meta, response })`;失敗 `onAction('api', { data, meta: { ...meta, apiError }, response: undefined })`。

- [ ] **Step 1: 寫失敗測試** — `config-form.spec.tsx` 追加(沿用 Task 3 的 `btn` helper):

```tsx
describe('api action', () => {
  const apiCfg = (over?: Partial<Extract<ButtonAction, { type: 'api' }>>) =>
    btn({ type: 'api', url: '/api/echo', ...over });

  it('sends { url, method, body: { data, meta } } through the injected fetcher', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} fetcher={fetcher} defaultValues={{ name: 'Roy', note: 'n' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const req = fetcher.mock.calls[0]![0];
    expect(req.url).toBe('/api/echo');
    expect(req.method).toBe('POST');
    expect(req.body.data).toEqual({ name: 'Roy', note: 'n' });
    expect(req.body.meta.action).toEqual({ type: 'api' });
  });

  it('fields narrows the sent data', async () => {
    const fetcher = vi.fn().mockResolvedValue({});
    render(<ConfigForm config={apiCfg({ fields: ['name'] })} onSubmit={vi.fn()} fetcher={fetcher} defaultValues={{ name: 'Roy', note: 'n' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher.mock.calls[0]![0].body.data).toEqual({ name: 'Roy' });
  });

  it('success: shows message, maps response into fields, reports via onAction', async () => {
    const fetcher = vi.fn().mockResolvedValue({ result: { display: 'mapped!' } });
    const onAction = vi.fn();
    render(
      <ConfigForm
        config={apiCfg({ responseMap: { 'result.display': 'note', 'missing.path': 'name' } })}
        onSubmit={vi.fn()} onAction={onAction} fetcher={fetcher} defaultValues={{ name: 'keep', note: '' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(screen.getByText(/success/i)).toBeTruthy());
    expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('mapped!');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('keep');   // 取不到 → 跳過
    expect(onAction).toHaveBeenCalledWith('api', expect.objectContaining({ response: { result: { display: 'mapped!' } } }));
  });

  it('failure: shows error message and reports apiError via onAction', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    const onAction = vi.fn();
    render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} onAction={onAction} fetcher={fetcher} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(screen.getByText(/failed/i)).toBeTruthy());
    const payload = onAction.mock.calls[0]![1];
    expect(payload.meta.apiError).toBe('boom');
    expect(payload.response).toBeUndefined();
  });

  it('pending: button disabled while in flight', async () => {
    let resolve!: (v: unknown) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} fetcher={fetcher} />);
    const button = screen.getByRole('button', { name: 'Go' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveProperty('disabled', true));
    resolve({});
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
  });

  it('no fetcher: api button renders disabled', () => {
    render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveProperty('disabled', true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL —— api 分支未實作。

- [ ] **Step 3: 實作** — `config-form.tsx`:

state(pendingCaptures 旁):

```tsx
// api 動作狀態:同表單同時只允許一顆 in-flight。
const [apiState, setApiState] = React.useState<{ itemId: string; status: 'pending' | 'success' | 'error' } | null>(null);
```

dot-path 取值 helper(module-level):

```ts
function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), obj);
}
```

`runAction` 的 api 分支:

```tsx
if (action.type === 'api') {
  if (!fetcher || apiState?.status === 'pending') return;
  const sent = action.fields ? Object.fromEntries(Object.entries(data).filter(([k]) => action.fields!.includes(k))) : data;
  const meta = buildActionMeta({ config, data: sent, action: { type: 'api' }, metaProvider });
  setApiState({ itemId: item.id, status: 'pending' });
  try {
    const response = await fetcher({ url: action.url, method: action.method ?? 'POST', body: { data: sent, meta } });
    for (const [path, targetKey] of Object.entries(action.responseMap ?? {})) {
      const v = getPath(response, path);
      if (v !== undefined) setValue(targetKey, v, { shouldDirty: true });
    }
    setApiState({ itemId: item.id, status: 'success' });
    onAction?.('api', { data: sent, meta, response });
  } catch (err) {
    setApiState({ itemId: item.id, status: 'error' });
    onAction?.('api', { data: sent, meta: { ...meta, apiError: err instanceof Error ? err.message : String(err) }, response: undefined });
  }
}
```

renderItem 的 button 分支改(pending/disabled/訊息;`Loader2` 自 `lucide-react`,form-builder-ui 已有此依賴):

```tsx
if (item.kind === 'button') {
  const variant = BUTTON_VARIANT[item.variant ?? (item.action.type === 'submit' ? 'primary' : 'outline')];
  const isApi = item.action.type === 'api';
  const mine = apiState?.itemId === item.id ? apiState : null;
  const pending = mine?.status === 'pending';
  const apiDisabled = isApi && (!fetcher || apiState?.status === 'pending');
  const msg =
    mine?.status === 'success' ? resolveLabel((item.action as { messages?: { success?: LocalizedLabel } }).messages?.success ?? 'Success', locale)
    : mine?.status === 'error' ? resolveLabel((item.action as { messages?: { error?: LocalizedLabel } }).messages?.error ?? 'Request failed', locale)
    : null;
  return (
    <div key={item.id} data-item={item.id} className="flex min-w-0 items-center gap-2" style={place ? placementStyle(place) : fieldSpanStyle(undefined, flow, cols)}>
      <Button
        type="button"
        variant={variant}
        disabled={pendingCaptures.size > 0 || apiDisabled}
        title={isApi && !fetcher ? 'No fetcher provided' : undefined}
        onClick={() => void runAction(item)}
      >
        {pending && <Loader2 className="mr-1 size-4 animate-spin" />}
        {resolveLabel(item.label, locale)}
      </Button>
      {msg && <span className={`text-xs ${mine?.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{msg}</span>}
    </div>
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run && pnpm -F @rfjs/form-builder-ui typecheck && pnpm -F @rfjs/form-builder-ui lint`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "feat(form-builder-ui): add api button action with fetcher, response mapping and status ui

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 工具 — model.ts button kind + palette 卡

**Files:**
- Modify: `apps/web/src/tools/form-builder/model.ts`(Kind:8、Card:12、cardToItem:74、formConfigToCards:129)
- Modify: `apps/web/src/tools/form-builder/model.spec.ts`
- Modify: `apps/web/src/tools/form-builder/ui.tsx`(KIND_META:49、PALETTE:339、addCard:278)

**Interfaces:**
- Consumes: Task 1 `ButtonAction`/`ButtonItem`。
- Produces: `Card` 加 `action?: ButtonAction; buttonVariant?: 'primary'|'outline'|'ghost'|'destructive'; validate?: boolean`(命名 `buttonVariant` 避免與未來欄位撞名);cards↔FormConfig 雙向攜帶(Task 6/7 依賴)。

- [ ] **Step 1: 寫失敗測試** — `model.spec.ts` 追加:

```ts
describe('button cards', () => {
  it('round-trips a button card through FormConfig', () => {
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [{
      id: 'b1', groupId: 'g1', kind: 'button' as const, label: 'Save draft',
      action: { type: 'custom' as const, name: 'save-draft' }, buttonVariant: 'outline' as const, validate: true,
      col: 1, span: 3, row: 1,
    }];
    const config = cardsToFormConfig(groups, cards);
    const item = config.sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: 'button', label: 'Save draft', action: { type: 'custom', name: 'save-draft' }, variant: 'outline', validate: true });
    const back = formConfigToCards(config);
    expect(back.cards[0]).toMatchObject({ kind: 'button', action: { type: 'custom', name: 'save-draft' }, buttonVariant: 'outline', validate: true });
  });

  it('button card without explicit action defaults to custom', () => {
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [{ id: 'b1', groupId: 'g1', kind: 'button' as const, label: 'Button', col: 1, span: 3, row: 1 }];
    const item = cardsToFormConfig(groups, cards).sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: 'button', action: { type: 'custom', name: 'action-1' } });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-builder/model.spec.ts`
Expected: FAIL —— Kind 無 "button"(型別錯誤或 cardToItem switch 無分支)。

- [ ] **Step 3: 實作**

`model.ts`:

```ts
export type Kind = "field" | "content" | "divider" | "spacer" | "ai-note" | "button";
```

`Card` 介面加(`size` 之後):

```ts
  action?: ButtonAction;      // button
  buttonVariant?: "primary" | "outline" | "ghost" | "destructive"; // button
  validate?: boolean;         // button
```

（import 補 `type ButtonAction`。）`cardToItem` switch 加:

```ts
    case "button":
      return {
        id: c.id, kind: "button", label: c.label,
        action: c.action ?? { type: "custom", name: "action-1" },
        ...(c.buttonVariant ? { variant: c.buttonVariant } : {}),
        ...(c.validate !== undefined ? { validate: c.validate } : {}),
      };
```

`formConfigToCards` 的分支鏈(content 之後)加:

```ts
      } else if (item.kind === "button") {
        cards.push({ ...base, kind: "button", label: item.label, action: item.action, buttonVariant: item.variant, validate: item.validate });
```

`ui.tsx`:import 補 `MousePointerClick`(lucide-react);`KIND_META` 加:

```ts
  button: { color: "#10b981", icon: MousePointerClick, label: "Button" },
```

`PALETTE` 改 `["field", "content", "divider", "spacer", "ai-note", "button"]`。`addCard` 對 button 不需特例(`label: KIND_META.button.label` = "Button",action 由 `cardToItem` 預設補上;若 addCard 建的 Card 需要顯式 action,加 `...(kind === "button" ? { action: { type: "custom", name: "action-1" } } : {})`,以 inspector 能立即顯示為準)。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/form-builder/model.spec.ts src/tools/form-builder/ui.spec.tsx`
Expected: 全 PASS(ui.spec 既有測試不受 palette 增項影響;若有 palette 數量斷言,同步更新並在報告註明)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/model.ts apps/web/src/tools/form-builder/model.spec.ts apps/web/src/tools/form-builder/ui.tsx
git commit -m "feat(web): add button card kind to form-builder canvas model and palette

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 工具 — inspector Action 面板

**Files:**
- Create: `apps/web/src/tools/form-builder/inspector/action.tsx`
- Create: `apps/web/src/tools/form-builder/inspector/action.spec.tsx`
- Modify: `apps/web/src/tools/form-builder/inspector/settings-panel.tsx`(掛入新 Section;Basics 的 field-only 欄位對 button 隱藏)

**Interfaces:**
- Consumes: Task 5 的 `Card.action/buttonVariant/validate`、既有 `Section`(`./section`)、`onChange: (p: Partial<Card>) => void`、`siblingFields`(既有 prop,提供 field key 清單)。
- Produces: `ActionSection({ card, onChange, siblingFields })` 元件。

- [ ] **Step 1: 寫失敗測試** — `action.spec.tsx`(比照既有 inspector spec 的 render 模式,如 `validation.spec.tsx`):

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "../model";
import { ActionSection } from "./action";

const btnCard = (over?: Partial<Card>): Card => ({
  id: "b1", groupId: "g1", kind: "button", label: "Go",
  action: { type: "custom", name: "save-draft" },
  col: 1, span: 3, row: 1, ...over,
});

const fields = [{ key: "name", dataType: "string" }, { key: "amount", dataType: "numeric" }];

describe("ActionSection", () => {
  it("switching type to clear shows the field multi-select and writes a valid clear action", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard()} onChange={onChange} siblingFields={fields} />);
    fireEvent.change(screen.getByLabelText(/action type/i), { target: { value: "clear" } });
    expect(onChange).toHaveBeenCalledWith({ action: { type: "clear", fields: [] } });
  });

  it("clear: toggling a field key adds it to action.fields", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard({ action: { type: "clear", fields: [] } })} onChange={onChange} siblingFields={fields} />);
    fireEvent.click(screen.getByLabelText("name"));
    expect(onChange).toHaveBeenCalledWith({ action: { type: "clear", fields: ["name"] } });
  });

  it("custom: renders the name input", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard()} onChange={onChange} siblingFields={fields} />);
    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: "notify" } });
    expect(onChange).toHaveBeenCalledWith({ action: { type: "custom", name: "notify" } });
  });

  it("api: renders url/method and responseMap editor", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard({ action: { type: "api", url: "/x" } })} onChange={onChange} siblingFields={fields} />);
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: "/api/y" } });
    expect(onChange).toHaveBeenCalledWith({ action: { type: "api", url: "/api/y" } });
    expect(screen.getByText(/response map/i)).toBeTruthy();
  });

  it("validate switch writes through", () => {
    const onChange = vi.fn();
    render(<ActionSection card={btnCard()} onChange={onChange} siblingFields={fields} />);
    fireEvent.click(screen.getByLabelText(/validate before run/i));
    expect(onChange).toHaveBeenCalledWith({ validate: true });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-builder/inspector/action.spec.tsx`
Expected: FAIL —— 模組不存在。

- [ ] **Step 3: 實作**

`action.tsx`(樣式沿用 inspector 慣例:`INPUT_CLS` 同 settings-panel 的 input class —— 從該檔抽出共用常數或本檔複製一份;label 用原生 `<label>` + text-xs 模式):

```tsx
"use client";
import * as React from "react";

import type { ButtonAction } from "@rfjs/form-builder";
import type { Card } from "../model";

const INPUT_CLS = "rounded-md border border-input bg-background px-2 py-1.5 text-sm";
const TYPES: ButtonAction["type"][] = ["submit", "reset", "clear", "custom", "api"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** 依 type 切換的預設 action 值(切換時舊參數不保留 —— 各型別參數互不相容)。 */
function defaultAction(type: ButtonAction["type"]): ButtonAction {
  switch (type) {
    case "submit": return { type: "submit" };
    case "reset": return { type: "reset" };
    case "clear": return { type: "clear", fields: [] };
    case "custom": return { type: "custom", name: "action-1" };
    case "api": return { type: "api", url: "" };
  }
}

export function ActionSection({
  card, onChange, siblingFields = [],
}: { card: Card; onChange: (p: Partial<Card>) => void; siblingFields?: { key: string; dataType: string }[] }) {
  const action = card.action ?? { type: "custom" as const, name: "action-1" };
  const patch = (a: ButtonAction) => onChange({ action: a });

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Action type
        <select className={INPUT_CLS} value={action.type} onChange={(e) => patch(defaultAction(e.target.value as ButtonAction["type"]))}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      {action.type === "clear" && (
        <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
          <legend>Fields to clear</legend>
          {siblingFields.map((f) => (
            <label key={f.key} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={f.key}
                checked={action.fields.includes(f.key)}
                onChange={(e) =>
                  patch({ type: "clear", fields: e.target.checked ? [...action.fields, f.key] : action.fields.filter((k) => k !== f.key) })
                }
              />
              <span className="font-mono">{f.key}</span>
            </label>
          ))}
        </fieldset>
      )}

      {action.type === "custom" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Event name
          <input className={`${INPUT_CLS} font-mono`} value={action.name} onChange={(e) => patch({ type: "custom", name: e.target.value })} />
        </label>
      )}

      {action.type === "api" && (
        <>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            URL
            <input className={`${INPUT_CLS} font-mono`} value={action.url} onChange={(e) => patch({ ...action, url: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Method
            <select className={INPUT_CLS} value={action.method ?? "POST"} onChange={(e) => patch({ ...action, method: e.target.value as (typeof METHODS)[number] })}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
            <legend>Send fields (empty = all visible)</legend>
            {siblingFields.map((f) => {
              const sel = action.fields ?? [];
              return (
                <label key={f.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`send ${f.key}`}
                    checked={sel.includes(f.key)}
                    onChange={(e) => {
                      const next = e.target.checked ? [...sel, f.key] : sel.filter((k) => k !== f.key);
                      patch({ ...action, fields: next.length ? next : undefined });
                    }}
                  />
                  <span className="font-mono">{f.key}</span>
                </label>
              );
            })}
          </fieldset>
          <ResponseMapEditor action={action} patch={patch} siblingFields={siblingFields} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Success message
            <input className={INPUT_CLS} value={typeof action.messages?.success === "string" ? action.messages.success : ""} onChange={(e) => patch({ ...action, messages: { ...action.messages, success: e.target.value || undefined } })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Error message
            <input className={INPUT_CLS} value={typeof action.messages?.error === "string" ? action.messages.error : ""} onChange={(e) => patch({ ...action, messages: { ...action.messages, error: e.target.value || undefined } })} />
          </label>
        </>
      )}

      {(action.type === "submit" || action.type === "custom" || action.type === "api") && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            aria-label="Validate before run"
            checked={card.validate ?? action.type === "submit"}
            onChange={(e) => onChange({ validate: e.target.checked })}
          />
          Validate before run
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Variant
        <select className={INPUT_CLS} value={card.buttonVariant ?? (action.type === "submit" ? "primary" : "outline")} onChange={(e) => onChange({ buttonVariant: e.target.value as Card["buttonVariant"] })}>
          {(["primary", "outline", "ghost", "destructive"] as const).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
    </div>
  );
}

/** responseMap 的 key-value 列表編輯(path → field key)。 */
function ResponseMapEditor({
  action, patch, siblingFields,
}: { action: Extract<ButtonAction, { type: "api" }>; patch: (a: ButtonAction) => void; siblingFields: { key: string; dataType: string }[] }) {
  const entries = Object.entries(action.responseMap ?? {});
  const write = (next: [string, string][]) =>
    patch({ ...action, responseMap: next.length ? Object.fromEntries(next) : undefined });
  return (
    <fieldset className="flex flex-col gap-1 text-xs text-muted-foreground">
      <legend>Response map (path → field)</legend>
      {entries.map(([path, target], i) => (
        <div key={i} className="flex items-center gap-1">
          <input className={`${INPUT_CLS} min-w-0 flex-1 font-mono`} aria-label={`response path ${i}`} value={path} onChange={(e) => write(entries.map((en, j) => (j === i ? [e.target.value, en[1]] : en)) as [string, string][])} />
          <span>→</span>
          <select className={`${INPUT_CLS} min-w-0 flex-1`} aria-label={`target field ${i}`} value={target} onChange={(e) => write(entries.map((en, j) => (j === i ? [en[0], e.target.value] : en)) as [string, string][])}>
            {siblingFields.map((f) => <option key={f.key} value={f.key}>{f.key}</option>)}
          </select>
          <button type="button" aria-label={`remove mapping ${i}`} className="text-muted-foreground hover:text-foreground" onClick={() => write(entries.filter((_, j) => j !== i) as [string, string][])}>×</button>
        </div>
      ))}
      <button
        type="button"
        className="self-start rounded-md border border-input px-2 py-1 hover:bg-accent"
        onClick={() => write([...entries, ["", siblingFields[0]?.key ?? ""]] as [string, string][])}
        disabled={siblingFields.length === 0}
      >
        + mapping
      </button>
    </fieldset>
  );
}
```

`settings-panel.tsx`:import `ActionSection`;`isField` 旁加 `const isButton = card.kind === "button";`;Basics 區的 Width/Group 保留、field-only 欄位照舊由 `isField` gate;在 Validation Section 之前插入:

```tsx
      {isButton ? (
        <Section title="Action">
          <ActionSection card={card} onChange={onChange} siblingFields={siblingFields} />
        </Section>
      ) : null}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/form-builder/inspector/`
Expected: 全 PASS(既有 inspector spec 不受影響)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/inspector/action.tsx apps/web/src/tools/form-builder/inspector/action.spec.tsx apps/web/src/tools/form-builder/inspector/settings-panel.tsx
git commit -m "feat(web): add button action inspector panel to form-builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 工具 — SubmissionPanel 動作顯示 + Preview 接線 + 範例

**Files:**
- Modify: `apps/web/src/tools/form-builder/submission-panel.tsx`(meta 型別改 `ActionMeta`,顯示 action/apiError)
- Modify: `apps/web/src/tools/form-builder/submission-panel.spec.tsx`
- Modify: `apps/web/src/tools/form-builder/ui.tsx`(Preview 分頁的兩處 `<ConfigForm>`:490、506 —— 接 `onSubmit`/`onAction`/echo fetcher)
- Modify: `apps/web/src/tools/form-builder/ui.spec.tsx`
- Modify: `apps/web/src/tools/form-builder/sample.ts`(範例加按鈕)

**Interfaces:**
- Consumes: Task 2 `ActionMeta`;Task 3/4 的動作行為;Task 5 的 button card。
- Produces: 使用者可在 Preview 直接看到動作 payload。

- [ ] **Step 1: 寫失敗測試**

`submission-panel.spec.tsx` 追加:

```tsx
it('shows the firing action and apiError when present', () => {
  render(
    <SubmissionPanel
      payload={{
        data: { a: 1 },
        meta: { valid: true, errors: {}, visibleKeys: ['a'], schemaVersion: 1, timestamp: 't', action: { type: 'custom', name: 'save-draft' }, apiError: 'boom' },
      }}
    />,
  );
  expect(screen.getByText(/custom/)).toBeTruthy();
  expect(screen.getByText(/save-draft/)).toBeTruthy();
  expect(screen.getByText(/boom/)).toBeTruthy();
});
```

`ui.spec.tsx` 追加(沿用該檔既有 render/mock 模式;Preview 分頁切換的既有測試已示範路徑):

```tsx
it('preview: clicking a custom button surfaces the action in the submission panel', async () => {
  renderTool();
  fireEvent.click(screen.getByRole('button', { name: /preview/i }));
  fireEvent.click(await screen.findByRole('button', { name: /save draft/i }));
  await waitFor(() => expect(screen.getAllByText(/save-draft/).length).toBeGreaterThan(0));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-builder/submission-panel.spec.tsx src/tools/form-builder/ui.spec.tsx`
Expected: FAIL —— SubmissionPanel 不顯示 action;範例無 Save draft 按鈕。

- [ ] **Step 3: 實作**

`submission-panel.tsx`:props 型別改 `payload: { data: Record<string, unknown>; meta: SubmissionMeta | ActionMeta } | null`(import `ActionMeta`);Metadata 區塊在 Status Badge 之後加:

```tsx
{'action' in meta && meta.action != null && (
  <div className="mb-3 space-y-1">
    <p className="text-xs font-medium text-muted-foreground">Action:</p>
    <p className="font-mono text-xs text-foreground">
      {(meta as ActionMeta).action.type}
      {(meta as ActionMeta).action.name ? ` — ${(meta as ActionMeta).action.name}` : ''}
    </p>
  </div>
)}
{'apiError' in meta && (meta as ActionMeta).apiError && (
  <p className="mb-3 text-xs text-red-600 dark:text-red-400">API error: {(meta as ActionMeta).apiError}</p>
)}
```

`ui.tsx` Preview 區:加 state 與 echo fetcher(元件內):

```tsx
const [lastPayload, setLastPayload] = React.useState<{ data: Record<string, unknown>; meta: SubmissionMeta } | null>(null);
// Preview 用 echo fetcher:回傳收到的 body 加上 echoedAt,讓 responseMap 可示範。
const echoFetcher = React.useCallback(async (req: { url: string; body?: unknown }) => ({ echoedAt: new Date().toISOString(), received: req.body }), []);
```

兩處 `<ConfigForm>` 改:

```tsx
onSubmit={(p) => setLastPayload(p)}
onAction={(_name, p) => setLastPayload({ data: p.data, meta: p.meta })}
fetcher={echoFetcher}
```

（既有 `onPayloadChange` → SubmissionPanel 的 live 顯示照舊;動作 payload 與 live payload 若共用同一 state,以「動作觸發後覆蓋 live 值」的現有 UX 決策為準 —— 實作時對照現檔:如果 SubmissionPanel 目前吃 `onPayloadChange` 的 state,則動作 payload 寫入同一個 state。）

`sample.ts`:在最後一個 section 的 row 追加三顆按鈕 item(id 唯一、layout placements 同步加 —— 對齊該檔既有 placement 結構):

```ts
{ id: "btn_submit", kind: "button", label: { en: "Submit request", "zh-TW": "送出申請" }, action: { type: "submit" }, variant: "primary" },
{ id: "btn_draft", kind: "button", label: { en: "Save draft", "zh-TW": "存草稿" }, action: { type: "custom", name: "save-draft" } },
{ id: "btn_clear", kind: "button", label: { en: "Clear", "zh-TW": "清除" }, action: { type: "clear", fields: ["<key1>", "<key2>"] }, variant: "ghost" },
```

（**先讀 sample.ts**:`<key1>`/`<key2>` 填該檔頭兩個 field 的實際 key 值 —— 不得留空陣列(schema 要求 min 1)。placements:三顆各 span 3、同一新 row,row 值 = 該 section 現有最大 row + 1。）

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/form-builder/ && pnpm -F web check-types && pnpm -F web lint`
Expected: 全 PASS(check-types 失敗且訊息為 @rfjs/* 解析 → 先 `pnpm build:packages` 再重跑)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/submission-panel.tsx apps/web/src/tools/form-builder/submission-panel.spec.tsx apps/web/src/tools/form-builder/ui.tsx apps/web/src/tools/form-builder/ui.spec.tsx apps/web/src/tools/form-builder/sample.ts
git commit -m "feat(web): surface action payloads in form-builder preview with sample buttons

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: e2e + 全套驗證

**Files:**
- Modify: `apps/web/e2e/form-builder.e2e.ts`(若無此檔,建立;先 `ls apps/web/e2e/` 對照現有命名)

**Interfaces:**
- Consumes: Task 7 的範例按鈕(accessible name "Save draft")與 SubmissionPanel 顯示。

- [ ] **Step 1: 追加 e2e 測試**:

```ts
test("preview: custom action button surfaces its payload in the submission panel", async ({ page }) => {
  await page.goto("/en/tools/form-builder");
  await page.getByRole("button", { name: /preview/i }).click();
  await page.getByRole("button", { name: /save draft/i }).click();
  await expect(page.getByText(/save-draft/).first()).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 2: 跑 e2e**

Run: `pnpm -F web test:e2e`
Expected: 全 PASS(含既有全部 e2e;port 3002 被占時 `E2E_PORT=3012`)。

- [ ] **Step 3: 全套單元 + 型別**

Run: `pnpm -F @rfjs/form-builder test && pnpm -F @rfjs/form-builder-ui test && pnpm -F web test && pnpm typecheck`
Expected: 全 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/
git commit -m "test(web): cover form-builder action buttons in e2e

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 真渲染驗證 + PR(主 session 執行,非 subagent)

**Files:** 無程式變更;產出截圖供使用者驗收。

- [ ] **Step 1:** `pnpm -F web build` → `cd apps/web && pnpm exec next start -p 3005`。
- [ ] **Step 2:** Playwright 腳本截圖(存 scratchpad;light + dark):
  - Canvas 分頁:palette 有「Button」卡、畫布上三顆範例按鈕、inspector 開啟 button 卡顯示 Action 面板(type select/validate/variant)。
  - Preview 分頁:按「Save draft」→ SubmissionPanel 顯示 `action: custom — save-draft` 與 data/meta;按 Submit(空必填)→ 擋下顯示錯誤。
- [ ] **Step 3:** 截圖貼給使用者確認後 push + `gh pr create`(HOLD 不 merge)。PR 描述(英文)要點:button item kind + five actions、`{ data, meta }` envelope(breaking `onSubmit`,private packages)、api via injected fetcher + responseMap、inspector panel、changesets(form-builder minor 會發 npm)。
