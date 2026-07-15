# form-builder result item — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** form-builder 新增 `result` item kind —— api 按鈕回應的展示區(card/json,table 預留),完成「條件欄位 + api 按鈕 + result 區」的查詢型表單。

**Architecture:** engine 只加型別與 zod;renderer 在 ConfigForm 收存 api 成功回應(`apiResults`)並由新的純展示元件 `ResultView` 渲染;工具加 palette 卡/inspector 面板/範例。規格:`docs/superpowers/specs/2026-07-08-form-result-item-design.md`;視覺驗收基準:`docs/mockups/2026-07-08-form-result-item.html`(**每個任務開工前先讀 spec 對應章節**)。

**Tech Stack:** zod v4、react-hook-form(既有)、vitest + testing-library、Playwright e2e。

## Global Constraints

- 工作目錄:worktree `/home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-form-result`,分支 `feat-form-result`(基於 `5ad3141`,已含 #232 action model 與 #233 ai-assist)。
- **並行紅線 — 絕對不碰**:`packages/web-core/**`、`apps/web/src/tools/{index,messages}.ts`、`apps/web/src/tools/index.spec.ts`、`apps/web/next.config.js`、`apps/web/package.json`(歸 table-builder session)。本 session 只動 `packages/form-builder/**`、`packages/form-builder-ui/**`、`apps/web/src/tools/form-builder/**`、`apps/web/e2e/form-builder.e2e.ts`。
- **card 保持零配置**:只有 `maxItems`;不得加欄位選取/排序/格式化(那是 table 模式 / table-builder 的事)。
- Commit:英文 conventional commits(subject 全小寫),結尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- Changesets:`@rfjs/form-builder` minor(Task 1)、`@rfjs/form-builder-ui` minor(Task 2);手寫 markdown,不跑互動 CLI;apps 不寫。
- 測試指令:`pnpm -F @rfjs/form-builder vitest:run`、`pnpm -F @rfjs/form-builder-ui vitest:run`、`pnpm -F web vitest:run <path>`(worktree 根執行)。engine 改完先 `pnpm build:packages` 再驗 web/ui 型別。
- 已知 baseline:`@rfjs/form-builder` typecheck 有 3 個 main 上就存在的錯誤(config-schema ZodType/DOM lib)—— 不是回歸,不要試圖修;判斷回歸一律與未改動 tree 比對。
- inspector/palette 文案沿用硬編英文慣例;範例 label 用 LocalizedLabel(en + zh-TW)。
- e2e 撞 port 3002 時用 `E2E_PORT=3013`(另一個並行 session 用 3012)。

---

### Task 1: Engine — ResultItem 型別 + zod + makeItem + changeset

**Files:**
- Modify: `packages/form-builder/src/types.ts`(ItemKind:84、FormItem:129、ButtonItem 之後插入)
- Modify: `packages/form-builder/src/config-schema.ts`(formItemSchema 的 discriminatedUnion)
- Modify: `packages/form-builder/src/config-schema.spec.ts`
- Modify: `packages/form-builder/src/tree-ops.ts`(makeItem switch,`case 'button'` 在 :49)
- Modify: `packages/form-builder/src/tree-ops.spec.ts`
- Create: `.changeset/form-result-item-engine.md`

**Interfaces:**
- Produces(後續任務全依賴):

```ts
export interface ResultItem {
  id: string;
  kind: 'result';
  mode: 'card' | 'json' | 'table';
  /** 綁定的 api 按鈕 item id;缺省 = 顯示全域最後一次 api 成功回應。 */
  sourceId?: string;
  /** dot path 先取子節點再渲染(同 responseMap 語法);缺省渲染整包回應。 */
  dataPath?: string;
  /** card 模式陣列上限,預設 10。 */
  maxItems?: number;
  /** mode:'table' 預留:未來放 @rfjs/table-builder 的 TableConfig;v1 透傳不解讀。 */
  table?: unknown;
  /** 空狀態文案;缺省內建 'No result yet'。 */
  emptyText?: LocalizedLabel;
}
```

- `ItemKind` 加 `'result'`;`FormItem` 聯集加 `ResultItem`。

- [ ] **Step 1: 寫失敗測試** — `config-schema.spec.ts` 追加:

```ts
describe('result items', () => {
  const withItem = (item: unknown) => ({
    version: 1,
    sections: [{ id: 's1', rows: [{ id: 'r1', items: [item] }] }],
  });

  it('accepts minimal and full result items', () => {
    const minimal = { id: 'res1', kind: 'result', mode: 'json' };
    const full = {
      id: 'res2', kind: 'result', mode: 'card',
      sourceId: 'btn1', dataPath: 'data.items', maxItems: 5,
      table: { anything: true }, emptyText: { en: 'Nothing', 'zh-TW': '沒有資料' },
    };
    for (const item of [minimal, full]) {
      const r = formConfigSchema.safeParse(withItem(item));
      expect(r.success, JSON.stringify(item)).toBe(true);
    }
  });

  it('rejects invalid result items: missing mode, unknown mode, non-positive maxItems', () => {
    const bad = [
      { id: 'x', kind: 'result' },
      { id: 'x', kind: 'result', mode: 'grid' },
      { id: 'x', kind: 'result', mode: 'card', maxItems: 0 },
    ];
    for (const item of bad) {
      const r = formConfigSchema.safeParse(withItem(item));
      expect(r.success, JSON.stringify(item)).toBe(false);
    }
  });
});
```

`tree-ops.spec.ts` 追加(比照既有 makeItem 測試寫法):

```ts
it("makeItem('result') gives a json-mode result item", () => {
  const item = makeItem('result', 'res-1');
  expect(item).toMatchObject({ id: 'res-1', kind: 'result', mode: 'json' });
});
```

（`makeItem` 的實際簽名以 `tree-ops.ts` 現檔為準 —— 若第二參數不是 id,對照既有 button case 測試調整呼叫方式,斷言語義不變。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder vitest:run src/config-schema.spec.ts src/tree-ops.spec.ts`
Expected: FAIL —— result 不在 discriminated union / makeItem 無此 case。

- [ ] **Step 3: 實作**

`types.ts`:`ItemKind` 改為含 `'result'`;`ButtonItem`(:120)之後插入上方 Interfaces 區塊的 `ResultItem`;`FormItem` 聯集加 `| ResultItem`。

`config-schema.ts`:`buttonItemSchema` 之後加(`localizedLabelSchema` 沿用檔內既有):

```ts
const resultItemSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('result'),
  mode: z.enum(['card', 'json', 'table']),
  sourceId: z.string().min(1).optional(),
  dataPath: z.string().min(1).optional(),
  maxItems: z.number().int().positive().optional(),
  table: z.unknown().optional(),
  emptyText: localizedLabelSchema.optional(),
});
```

加入 `formItemSchema` 的 discriminatedUnion 陣列。

`tree-ops.ts` 的 `makeItem` switch 加:

```ts
    case 'result':
      return { id, kind: 'result', mode: 'json' };
```

（對照現檔 button case 的實際回傳形狀/簽名。）

`.changeset/form-result-item-engine.md`:

```md
---
"@rfjs/form-builder": minor
---

Add `ResultItem` (`kind: 'result'`): an api-response display area with `mode: 'card' | 'json' | 'table'` (table reserved for @rfjs/table-builder), optional source button binding, dot-path extraction, and card item cap.
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder vitest:run && pnpm build:packages`
Expected: 全 PASS;build 成功(供後續任務吃新型別)。typecheck 僅剩 3 個既有 baseline 錯誤。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder/src/types.ts packages/form-builder/src/config-schema.ts packages/form-builder/src/config-schema.spec.ts packages/form-builder/src/tree-ops.ts packages/form-builder/src/tree-ops.spec.ts .changeset/form-result-item-engine.md
git commit -m "feat(form-builder): add result item kind for api response display

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Renderer — ResultView 純展示元件 + changeset

**Files:**
- Create: `packages/form-builder-ui/src/result-view.tsx`
- Create: `packages/form-builder-ui/src/result-view.spec.tsx`
- Create: `.changeset/form-result-item-ui.md`

（barrel `index.ts` 是 `export *`,新檔要補一行 `export * from './result-view';`。）

**Interfaces:**
- Consumes: Task 1 `ResultItem`(僅型別)、`LocalizedLabel`/`resolveLabel`(`@rfjs/form-builder`)、lucide `Loader2`。
- Produces(Task 3 依賴):

```ts
export type ResultViewState = 'empty' | 'loading' | 'error' | 'ready';
export function ResultView(props: {
  mode: 'card' | 'json' | 'table';
  state: ResultViewState;
  value?: unknown;            // state==='ready' 時的展示值(已套 dataPath)
  maxItems?: number;          // card 陣列上限,預設 10
  emptyText?: LocalizedLabel;
  locale?: string;
}): React.JSX.Element;
```

- [ ] **Step 1: 寫失敗測試** — `result-view.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { ResultView } from './result-view';

describe('ResultView states', () => {
  it('empty: shows default text or custom LocalizedLabel', () => {
    const { rerender } = render(<ResultView mode="card" state="empty" />);
    expect(screen.getByText('No result yet')).toBeTruthy();
    rerender(<ResultView mode="card" state="empty" emptyText={{ en: 'Nothing', 'zh-TW': '沒有資料' }} locale="zh-TW" />);
    expect(screen.getByText('沒有資料')).toBeTruthy();
  });

  it('loading: shows spinner text', () => {
    render(<ResultView mode="card" state="loading" />);
    expect(screen.getByText(/loading/i)).toBeTruthy();
  });

  it('error: shows failure text', () => {
    render(<ResultView mode="card" state="error" />);
    expect(screen.getByText(/request failed/i)).toBeTruthy();
  });
});

describe('ResultView card mode', () => {
  it('object → one key-value card; non-scalar values stringified', () => {
    render(<ResultView mode="card" state="ready" value={{ name: 'Roy', days: 3, detail: { dept: 'HR' } }} />);
    expect(screen.getByText('name')).toBeTruthy();
    expect(screen.getByText('Roy')).toBeTruthy();
    expect(screen.getByText('{"dept":"HR"}')).toBeTruthy();
  });

  it('array → stacked cards capped by maxItems with a "+N more" hint', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }));
    render(<ResultView mode="card" state="ready" value={rows} maxItems={3} />);
    expect(screen.getAllByText('id')).toHaveLength(3);
    expect(screen.getByText('+ 2 more')).toBeTruthy();
  });

  it('array within default cap renders all items and no hint', () => {
    render(<ResultView mode="card" state="ready" value={[{ a: 1 }, { a: 2 }]} />);
    expect(screen.getAllByText('a')).toHaveLength(2);
    expect(screen.queryByText(/more$/)).toBeNull();
  });

  it('scalar → single value card', () => {
    render(<ResultView mode="card" state="ready" value={42} />);
    expect(screen.getByText('42')).toBeTruthy();
  });
});

describe('ResultView json / table modes', () => {
  it('json: pretty prints', () => {
    render(<ResultView mode="json" state="ready" value={{ a: 1 }} />);
    expect(screen.getByText(/"a": 1/)).toBeTruthy();
  });

  it('table: renders the pending placeholder', () => {
    render(<ResultView mode="table" state="ready" value={[]} />);
    expect(screen.getByText(/pending .*table-builder/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/result-view.spec.tsx`
Expected: FAIL —— 模組不存在。

- [ ] **Step 3: 實作** — `result-view.tsx`(視覺對齊 mockup:虛線狀態框、kv 卡 key 左 mono、+N more、pre 面板):

```tsx
'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { resolveLabel, type LocalizedLabel } from '@rfjs/form-builder';

export type ResultViewState = 'empty' | 'loading' | 'error' | 'ready';

export interface ResultViewProps {
  mode: 'card' | 'json' | 'table';
  state: ResultViewState;
  value?: unknown;
  maxItems?: number;
  emptyText?: LocalizedLabel;
  locale?: string;
}

const isScalar = (v: unknown): v is string | number | boolean =>
  v === null || ['string', 'number', 'boolean'].includes(typeof v);

function KvCard({ value }: { value: unknown }) {
  if (isScalar(value)) {
    return <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">{String(value)}</div>;
  }
  const entries = Object.entries((value ?? {}) as Record<string, unknown>);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-input bg-muted/30 px-3 py-2.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-3 text-sm">
          <span className="w-24 shrink-0 pt-px font-mono text-xs text-muted-foreground">{k}</span>
          {isScalar(v) ? (
            <span className="min-w-0 break-words">{String(v)}</span>
          ) : (
            <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{JSON.stringify(v)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const stateBox = 'flex min-h-24 items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/20 text-sm text-muted-foreground';

/** api 回應的純展示元件 —— card 刻意零配置(僅 maxItems);欄位級控制屬 table 模式(table-builder)。 */
export function ResultView({ mode, state, value, maxItems, emptyText, locale = 'en' }: ResultViewProps) {
  if (state === 'empty') {
    return <div className={stateBox}>{emptyText ? resolveLabel(emptyText, locale) : 'No result yet'}</div>;
  }
  if (state === 'loading') {
    return (
      <div className={stateBox}>
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (state === 'error') {
    return <div className={`${stateBox} border-destructive/40 text-destructive`}>Request failed</div>;
  }

  if (mode === 'json') {
    return (
      <pre className="max-h-64 overflow-auto rounded-md border border-input bg-muted/30 p-3 font-mono text-xs leading-relaxed">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (mode === 'table') {
    return (
      <div className={`${stateBox} flex-col gap-1`}>
        <span className="font-medium text-foreground/70">Table view</span>
        <span className="text-xs">pending @rfjs/table-builder</span>
      </div>
    );
  }

  // mode === 'card'
  if (Array.isArray(value)) {
    const cap = maxItems ?? 10;
    const shown = value.slice(0, cap);
    const rest = value.length - shown.length;
    return (
      <div className="flex flex-col gap-2">
        {shown.map((row, i) => (
          <KvCard key={i} value={row} />
        ))}
        {rest > 0 && (
          <div className="rounded-md border border-dashed border-input py-1.5 text-center text-xs text-muted-foreground">{`+ ${rest} more`}</div>
        )}
      </div>
    );
  }
  return <KvCard value={value} />;
}
```

`index.ts` 加 `export * from './result-view';`。

`.changeset/form-result-item-ui.md`:

```md
---
"@rfjs/form-builder-ui": minor
---

ConfigForm renders `result` items: api-response display areas with card / json modes (table placeholder pending @rfjs/table-builder), source-button binding, dot-path extraction, and empty / loading / error states.
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/result-view.spec.tsx && pnpm -F @rfjs/form-builder-ui check-types`
Expected: 測試全 PASS;check-types 0 錯誤。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/result-view.tsx packages/form-builder-ui/src/result-view.spec.tsx packages/form-builder-ui/src/index.ts .changeset/form-result-item-ui.md
git commit -m "feat(form-builder-ui): add resultview display component for api responses

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Renderer — ConfigForm 接線(apiResults 狀態 + result 分支)

**Files:**
- Modify: `packages/form-builder-ui/src/config-form.tsx`(apiState:213 附近加狀態;api 成功分支:~:375;config-change effect;renderItem:385 加分支)
- Modify: `packages/form-builder-ui/src/config-form.spec.tsx`

**Interfaces:**
- Consumes: Task 1 `ResultItem`、Task 2 `ResultView`、既有 `apiState`/`getPath`/`runAction`/epoch。
- Produces: result item 在表單中的完整行為(Task 4-6 的工具層依賴)。

- [ ] **Step 1: 寫失敗測試** — `config-form.spec.tsx` 追加(沿用檔內既有 `btn` helper 的寫法;`waitFor`/`fireEvent` 既有 import):

```tsx
describe('result items', () => {
  const resultCfg = (result: Partial<import('@rfjs/form-builder').ResultItem>, apiOver?: object): FormConfig => ({
    version: 1,
    sections: [{
      id: 's1',
      rows: [{
        id: 'r1',
        items: [
          { id: 'f1', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' },
          { id: 'b1', kind: 'button', label: 'Query', action: { type: 'api', url: '/x', ...apiOver } },
          { id: 'b2', kind: 'button', label: 'Other', action: { type: 'api', url: '/y' } },
          { id: 'res1', kind: 'result', mode: 'json', ...result },
        ],
      }],
    }],
  });

  it('starts empty, renders the bound response after the api button succeeds', async () => {
    const fetcher = vi.fn().mockResolvedValue({ hello: 'world' });
    render(<ConfigForm config={resultCfg({ sourceId: 'b1' })} onSubmit={vi.fn()} fetcher={fetcher} />);
    expect(screen.getByText('No result yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(screen.getByText(/"hello": "world"/)).toBeTruthy());
  });

  it('bound result ignores other buttons; unbound shows the last response', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ from: 'other' });
    render(
      <ConfigForm
        config={{
          ...resultCfg({ sourceId: 'b1' }),
          sections: [{
            id: 's1',
            rows: [{
              id: 'r1',
              items: [
                { id: 'b1', kind: 'button', label: 'Query', action: { type: 'api', url: '/x' } },
                { id: 'b2', kind: 'button', label: 'Other', action: { type: 'api', url: '/y' } },
                { id: 'res1', kind: 'result', mode: 'json', sourceId: 'b1' },
                { id: 'res2', kind: 'result', mode: 'json' },
              ],
            }],
          }],
        }}
        onSubmit={vi.fn()}
        fetcher={fetcher}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    // 綁定 b1 的 res1 不顯示 b2 的回應;未綁定的 res2 顯示
    await waitFor(() => expect(screen.getByText(/"from": "other"/)).toBeTruthy());
    expect(screen.getByText('No result yet')).toBeTruthy(); // res1 仍空
  });

  it('dataPath extracts a sub-node; missing path falls back to empty', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: { items: [{ id: 1 }] } });
    const { rerender } = render(
      <ConfigForm config={resultCfg({ sourceId: 'b1', mode: 'card', dataPath: 'data.items' })} onSubmit={vi.fn()} fetcher={fetcher} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(screen.getByText('id')).toBeTruthy());
    // 換一個取不到的 path,重新查詢:hasResponse 為真但 getPath undefined → 空狀態,不炸
    rerender(<ConfigForm config={resultCfg({ sourceId: 'b1', mode: 'card', dataPath: 'no.such' })} onSubmit={vi.fn()} fetcher={fetcher} />);
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('No result yet')).toBeTruthy());
  });

  it('shows loading while the bound button is pending and error on failure', async () => {
    let reject!: (e: Error) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise((_r, rej) => { reject = rej; }));
    render(<ConfigForm config={resultCfg({ sourceId: 'b1' })} onSubmit={vi.fn()} fetcher={fetcher} />);
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(screen.getByText(/loading/i)).toBeTruthy());
    reject(new Error('boom'));
    await waitFor(() => expect(screen.getByText(/request failed/i)).toBeTruthy());
  });

  it('config change clears stored responses', async () => {
    const fetcher = vi.fn().mockResolvedValue({ a: 1 });
    const cfg = resultCfg({ sourceId: 'b1' });
    const { rerender } = render(<ConfigForm config={cfg} onSubmit={vi.fn()} fetcher={fetcher} />);
    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    await waitFor(() => expect(screen.getByText(/"a": 1/)).toBeTruthy());
    rerender(<ConfigForm config={{ ...cfg }} onSubmit={vi.fn()} fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText('No result yet')).toBeTruthy());
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run src/config-form.spec.tsx`
Expected: FAIL —— result item 不渲染。

- [ ] **Step 3: 實作** — `config-form.tsx`:

import 加 `ResultView`(自 `./result-view`)與 `type ResultItem`(自 `@rfjs/form-builder`)。

`apiState` 旁加:

```tsx
// result item 的資料來源:各 api 按鈕的最新成功回應 + 全域最後一次。
const [apiResults, setApiResults] = React.useState<{
  byButtonId: Record<string, unknown>;
  last?: { buttonId: string; response: unknown };
}>({ byButtonId: {} });
```

api 成功分支(epoch check 之後、`setApiState({ status: 'success' })` 旁)加:

```tsx
setApiResults((prev) => ({
  byButtonId: { ...prev.byButtonId, [item.id]: response },
  last: { buttonId: item.id, response },
}));
```

config-change effect(現有 `reset(...)`/`setApiState(null)` 處)加 `setApiResults({ byButtonId: {} });`。

`renderItem` 加分支(button 分支之後、field fall-through 之前):

```tsx
if (item.kind === 'result') {
  const raw = item.sourceId !== undefined ? apiResults.byButtonId[item.sourceId] : apiResults.last?.response;
  const hasResponse = item.sourceId !== undefined ? item.sourceId in apiResults.byButtonId : apiResults.last !== undefined;
  const value = hasResponse && item.dataPath ? getPath(raw, item.dataPath) : raw;
  // 綁定時只理會來源按鈕的進行中/失敗;未綁定時理會任一 api 按鈕。
  const watching = item.sourceId === undefined || apiState?.itemId === item.sourceId;
  const state: ResultViewState =
    watching && apiState?.status === 'pending' ? 'loading'
    : watching && apiState?.status === 'error' && !hasResponse ? 'error'
    : !hasResponse || value === undefined ? 'empty'
    : 'ready';
  return (
    <div key={item.id} data-item={item.id} style={place ? placementStyle(place) : fieldSpanStyle(undefined, flow, cols)}>
      <ResultView mode={item.mode} state={state} value={value} maxItems={item.maxItems} emptyText={item.emptyText} locale={locale} />
    </div>
  );
}
```

（`ResultViewState` 型別 import 自 `./result-view`。）

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F @rfjs/form-builder-ui vitest:run && pnpm -F @rfjs/form-builder-ui check-types`
Expected: 全 PASS;0 型別錯誤。

- [ ] **Step 5: Commit**

```bash
git add packages/form-builder-ui/src/config-form.tsx packages/form-builder-ui/src/config-form.spec.tsx
git commit -m "feat(form-builder-ui): render result items from stored api responses

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 工具 — model.ts result kind + palette

**Files:**
- Modify: `apps/web/src/tools/form-builder/model.ts`(Kind:8、Card、cardToItem、formConfigToCards)
- Modify: `apps/web/src/tools/form-builder/model.spec.ts`
- Modify: `apps/web/src/tools/form-builder/ui.tsx`(KIND_META、PALETTE、seedSpan)

**Interfaces:**
- Consumes: Task 1 `ResultItem`。
- Produces: `Card` 加 `mode?: "card" | "json" | "table"; sourceId?: string; dataPath?: string; maxItems?: number; resultTable?: unknown; emptyText?: string`(工具層 emptyText 以 string 編輯,同 messages 慣例);cards↔FormConfig 雙向(Task 5/6 依賴)。

- [ ] **Step 1: 寫失敗測試** — `model.spec.ts` 追加:

```ts
describe('result cards', () => {
  it('round-trips a result card through FormConfig', () => {
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [{
      id: 'res1', groupId: 'g1', kind: 'result' as const, label: 'Result',
      mode: 'card' as const, sourceId: 'btn1', dataPath: 'data.items', maxItems: 5, emptyText: 'Nothing',
      col: 1, span: 12, row: 1,
    }];
    const config = cardsToFormConfig(groups, cards);
    const item = config.sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: 'result', mode: 'card', sourceId: 'btn1', dataPath: 'data.items', maxItems: 5, emptyText: 'Nothing' });
    const back = formConfigToCards(config);
    expect(back.cards[0]).toMatchObject({ kind: 'result', mode: 'card', sourceId: 'btn1', dataPath: 'data.items', maxItems: 5, emptyText: 'Nothing' });
  });

  it('result card without mode defaults to json', () => {
    const groups = [{ id: 'g1', title: 'G', collapsed: false }];
    const cards = [{ id: 'res1', groupId: 'g1', kind: 'result' as const, label: 'Result', col: 1, span: 12, row: 1 }];
    const item = cardsToFormConfig(groups, cards).sections![0]!.rows[0]!.items[0]!;
    expect(item).toMatchObject({ kind: 'result', mode: 'json' });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-builder/model.spec.ts`
Expected: FAIL(型別/缺 case)。

- [ ] **Step 3: 實作**

`model.ts`:`Kind` 加 `"result"`;`Card` 加上方 Interfaces 的六個選填欄位(import `ResultItem` 型別非必要,`mode` 直接字面聯集);`cardToItem` 加:

```ts
    case "result":
      return {
        id: c.id, kind: "result", mode: c.mode ?? "json",
        ...(c.sourceId ? { sourceId: c.sourceId } : {}),
        ...(c.dataPath ? { dataPath: c.dataPath } : {}),
        ...(c.maxItems !== undefined ? { maxItems: c.maxItems } : {}),
        ...(c.resultTable !== undefined ? { table: c.resultTable } : {}),
        ...(c.emptyText ? { emptyText: c.emptyText } : {}),
      };
```

`formConfigToCards` 分支鏈加:

```ts
      } else if (item.kind === "result") {
        cards.push({
          ...base, kind: "result", label: "Result",
          mode: item.mode, sourceId: item.sourceId, dataPath: item.dataPath,
          maxItems: item.maxItems, resultTable: item.table,
          emptyText: typeof item.emptyText === "string" ? item.emptyText : undefined,
        });
```

`ui.tsx`:import 加 `PanelBottom`(lucide-react);`KIND_META` 加:

```ts
  result: { color: "#0ea5e9", icon: PanelBottom, label: "Result" },
```

`PALETTE` 加 `"result"`(排在 `"button"` 之後);`seedSpan` 的非 field 分支已回傳 COLS(全寬)—— 確認 result 走到該分支即可,不用改。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/form-builder/model.spec.ts src/tools/form-builder/ui.spec.tsx && pnpm -F web check-types`
Expected: 全 PASS(check-types 若因 Kind 擴充在其他 Record 報缺 key,一併補上並在報告註明 —— 比照 #232 的 item-editor 前例:`packages/form-builder-ui/src/item-editor.tsx` 的 `Record<ItemKind, KindMeta>` 也要加 `result` 一行,這是本任務的授權外掛)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/model.ts apps/web/src/tools/form-builder/model.spec.ts apps/web/src/tools/form-builder/ui.tsx packages/form-builder-ui/src/item-editor.tsx
git commit -m "feat(web): add result card kind to form-builder canvas model and palette

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

（item-editor.tsx 若未變動則不加入。）

---

### Task 5: 工具 — inspector Result 面板

**Files:**
- Create: `apps/web/src/tools/form-builder/inspector/result.tsx`
- Create: `apps/web/src/tools/form-builder/inspector/result.spec.tsx`
- Modify: `apps/web/src/tools/form-builder/inspector/settings-panel.tsx`(`isResult` gate)
- Modify: `apps/web/src/tools/form-builder/ui.tsx`(SettingsPanel 呼叫端傳 `apiButtons`)

**Interfaces:**
- Consumes: Task 4 的 `Card` result 欄位;`Section`(`./section`)、`INPUT_CLS`(`./constants`,#232 前例)。
- Produces:

```tsx
export function ResultSection(props: {
  card: Card;
  onChange: (p: Partial<Card>) => void;
  apiButtons?: { id: string; label: string }[];   // 畫布上現有 api 按鈕
}): React.JSX.Element;
```

`SettingsPanel` props 加 `apiButtons?: { id: string; label: string }[]`(透傳);ui.tsx 呼叫端計算:

```tsx
apiButtons={cards.filter((c) => c.kind === "button" && c.action?.type === "api").map((c) => ({ id: c.id, label: cardLabel(c.label) }))}
```

- [ ] **Step 1: 寫失敗測試** — `result.spec.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "../model";
import { ResultSection } from "./result";

const resCard = (over?: Partial<Card>): Card => ({
  id: "res1", groupId: "g1", kind: "result", label: "Result",
  mode: "json", col: 1, span: 12, row: 1, ...over,
});
const apiButtons = [{ id: "btn_query", label: "Query" }];

describe("ResultSection", () => {
  it("mode select writes through; maxItems only visible for card mode", () => {
    const onChange = vi.fn();
    const { rerender } = render(<ResultSection card={resCard()} onChange={onChange} apiButtons={apiButtons} />);
    expect(screen.queryByLabelText(/max items/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^mode$/i), { target: { value: "card" } });
    expect(onChange).toHaveBeenCalledWith({ mode: "card" });
    rerender(<ResultSection card={resCard({ mode: "card" })} onChange={onChange} apiButtons={apiButtons} />);
    expect(screen.getByLabelText(/max items/i)).toBeTruthy();
  });

  it("source select lists api buttons plus the unbound option", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard()} onChange={onChange} apiButtons={apiButtons} />);
    const select = screen.getByLabelText(/source/i) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["Last api response", "Query"]);
    fireEvent.change(select, { target: { value: "btn_query" } });
    expect(onChange).toHaveBeenCalledWith({ sourceId: "btn_query" });
    fireEvent.change(select, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ sourceId: undefined });
  });

  it("dataPath / empty text write through", () => {
    const onChange = vi.fn();
    render(<ResultSection card={resCard()} onChange={onChange} apiButtons={apiButtons} />);
    fireEvent.change(screen.getByLabelText(/data path/i), { target: { value: "data.items" } });
    expect(onChange).toHaveBeenCalledWith({ dataPath: "data.items" });
    fireEvent.change(screen.getByLabelText(/empty text/i), { target: { value: "Nothing" } });
    expect(onChange).toHaveBeenCalledWith({ emptyText: "Nothing" });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-builder/inspector/result.spec.tsx`
Expected: FAIL —— 模組不存在。

- [ ] **Step 3: 實作** — `result.tsx`:

```tsx
"use client";
import * as React from "react";

import { INPUT_CLS } from "./constants";
import type { Card } from "../model";

const MODES = ["card", "json", "table"] as const;

export function ResultSection({
  card, onChange, apiButtons = [],
}: { card: Card; onChange: (p: Partial<Card>) => void; apiButtons?: { id: string; label: string }[] }) {
  const mode = card.mode ?? "json";
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Mode
        <select className={INPUT_CLS} value={mode} onChange={(e) => onChange({ mode: e.target.value as Card["mode"] })}>
          {MODES.map((m) => (
            <option key={m} value={m}>{m === "table" ? "table (coming soon)" : m}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Source
        <select
          className={INPUT_CLS}
          value={card.sourceId ?? ""}
          onChange={(e) => onChange({ sourceId: e.target.value || undefined })}
        >
          <option value="">Last api response</option>
          {apiButtons.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Data path
        <input className={`${INPUT_CLS} font-mono`} value={card.dataPath ?? ""} placeholder="e.g. data.items" onChange={(e) => onChange({ dataPath: e.target.value || undefined })} />
      </label>

      {mode === "card" && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Max items
          <input
            className={INPUT_CLS} type="number" min={1}
            value={card.maxItems ?? 10}
            onChange={(e) => { const n = Number(e.target.value); onChange({ maxItems: Number.isFinite(n) && n >= 1 ? n : undefined }); }}
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Empty text
        <input className={INPUT_CLS} value={card.emptyText ?? ""} placeholder="No result yet" onChange={(e) => onChange({ emptyText: e.target.value || undefined })} />
      </label>
    </div>
  );
}
```

`settings-panel.tsx`:import `ResultSection`;`isButton` 旁加 `const isResult = card.kind === "result";`;props 加 `apiButtons?: { id: string; label: string }[]`;Action Section 之後插入:

```tsx
      {isResult ? (
        <Section title="Result">
          <ResultSection card={card} onChange={onChange} apiButtons={apiButtons} />
        </Section>
      ) : null}
```

`ui.tsx` 的 `<SettingsPanel …>` 呼叫端加 `apiButtons={…}`(見 Interfaces)。

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/form-builder/inspector/ && pnpm -F web check-types`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/inspector/result.tsx apps/web/src/tools/form-builder/inspector/result.spec.tsx apps/web/src/tools/form-builder/inspector/settings-panel.tsx apps/web/src/tools/form-builder/ui.tsx
git commit -m "feat(web): add result inspector panel to form-builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 工具 — 範例 + Preview 驗證

**Files:**
- Modify: `apps/web/src/tools/form-builder/sample.ts`(`r_actions` row 之後加查詢按鈕 + result 區)
- Modify: `apps/web/src/tools/form-builder/ui.spec.tsx`

**Interfaces:**
- Consumes: 既有 `previewFetcher`(echo:回 `{ echoedAt, received: body }`,body = `{ data, meta }`)。

- [ ] **Step 1: 寫失敗測試** — `ui.spec.tsx` 追加(沿用檔內 renderTool/Preview 切換模式):

```tsx
it("preview: query api button renders its echoed response into the result card", async () => {
  renderTool();
  fireEvent.click(screen.getByRole("button", { name: "Preview", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: /^query$/i }));
  // echo fetcher 回 { echoedAt, received: { data, meta } };result dataPath received.data → kv 卡出現欄位 key
  await waitFor(() => expect(screen.getAllByText("name").length).toBeGreaterThan(0));
});
```

（若 `name` 撞到欄位 label 的 heading,改斷言 `data-item="res_query"` 容器內文字 —— 以實跑結果調整 selector,語義不變:result 卡渲染出 echo 的 data key。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run src/tools/form-builder/ui.spec.tsx`
Expected: FAIL —— 範例沒有 Query 按鈕。

- [ ] **Step 3: 實作** — `sample.ts` 的 `r_actions` row 之後追加兩個 row(同 section):

```ts
        {
          id: "r_query",
          items: [
            { id: "btn_query", kind: "button", label: { en: "Query", "zh-TW": "查詢" }, action: { type: "api", url: "/api/search", fields: ["name", "email"] } },
          ],
        },
        {
          id: "r_result",
          items: [
            { id: "res_query", kind: "result", mode: "card", sourceId: "btn_query", dataPath: "received.data", emptyText: { en: "Run a query to see results", "zh-TW": "按查詢看結果" } },
          ],
        },
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run src/tools/form-builder/ && pnpm -F web check-types && pnpm -F web lint`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/form-builder/sample.ts apps/web/src/tools/form-builder/ui.spec.tsx
git commit -m "feat(web): add query button and result card to form-builder sample

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: e2e + 全套驗證

**Files:**
- Modify: `apps/web/e2e/form-builder.e2e.ts`(追加一條)

- [ ] **Step 1: 追加 e2e**:

```ts
test("preview: query api button renders the echoed response in the result card", async ({ page }) => {
  await page.goto(URL);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await page.getByRole("button", { name: /^query$/i }).click();
  await expect(page.locator('[data-item="res_query"]')).toContainText("echoedAt", { timeout: 15_000 });
});
```

（result 綁 `dataPath: 'received.data'` 時卡片內不含 `echoedAt` —— 斷言以實際渲染為準:應改為 `toContainText("name")`(data 內的欄位 key)。先跑一次確認,兩者擇一,不得放寬成 truthy。）

- [ ] **Step 2: 跑 e2e**

Run: `pnpm -F web test:e2e`(port 撞就 `E2E_PORT=3013`)
Expected: 全 PASS(既有全部 + 新 1 條)。

- [ ] **Step 3: 全套**

Run: `pnpm -F @rfjs/form-builder test && pnpm -F @rfjs/form-builder-ui test && pnpm -F web test`
Expected: 全 PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/form-builder.e2e.ts
git commit -m "test(web): cover form-builder result card in e2e

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 真渲染驗證 + PR(主 session 執行,非 subagent)

**Files:** 無程式變更。

- [ ] **Step 1:** `pnpm -F web build` → `next start -p 3007`(避開另一 session 可能占用的 3005/3006)。
- [ ] **Step 2:** Playwright 截圖(light + dark,存 scratchpad),對照 mockup 驗收:
  - Canvas:palette 有 Result 卡、畫布上 res_query 卡、inspector Result 面板(mode/source/dataPath/maxItems/emptyText)。
  - Preview:初始空狀態文案 → 填 Name → 按 Query → result 卡渲染 echo data(kv 卡);切 json 模式確認 pretty print;錯誤/loading 狀態若可便捷觸發亦截。
- [ ] **Step 3:** 截圖貼給使用者確認後 push + `gh pr create`(HOLD 不 merge)。PR 描述(英文)要點:result item kind(card/json,table reserved for @rfjs/table-builder)、binding/dataPath/maxItems、四狀態、card-stays-dumb boundary、changesets 兩枚 minor。
