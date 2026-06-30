# @rfjs/bpmn Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 封裝 `bpmn-js` 的唯讀 BPMN 流程圖檢視器,做成 private 套件 `@rfjs/bpmn`(薄 React wrapper),並在 `apps/web` 加一個 `bpmn-viewer` tool 展示。

**Architecture:** 無頭薄封裝 —— 套件只提供 `<BpmnViewer>`(controlled `xml` prop + ref handle)、`useBpmnViewer` hook、型別;工具列/範例/上傳/錯誤面板等外殼留在 `apps/web` 展示頁(用 `@rfjs/web-ui`)。套件無 build step,由 Next.js `transpilePackages` 直接消費 source。bpmn-js 於 mount effect 內動態 import(SSR 安全),只在 client 端建立。

**Tech Stack:** React 19、`bpmn-js@^18.19.0`(NavigatedViewer,內建 TS 型別)、Vitest(jsdom,mock bpmn-js)、`@playwright/test`(net-new e2e)、Next.js(apps/web)。

## Global Constraints

- 全程在 worktree `.claude/worktrees/feat-bpmn-viewer` 內編輯/測試/commit(從 `origin/main` 建立)。
- 套件 `@rfjs/bpmn`:`"private": true`、`"type": "module"`、`"version": "0.0.0"`、`exports` 僅 `{ ".": "./src/index.ts" }`(無 dist)。
- React 為 `peerDependencies`(`^19.0.0`);`bpmn-js@^18.19.0` 為 `dependencies`。套件**不依賴** `@rfjs/web-ui`、**不使用 Tailwind**(因此 apps/web 不需加 `@source`,只需 `transpilePackages`)。
- **授權硬約束**:`NavigatedViewer` 自動加入的 `.bjs-powered-by`(Powered by bpmn.io)標誌**絕不可**用 CSS/DOM 隱藏。e2e 斷言其可見;code review 檢查無隱藏規則。
- 檔案命名 kebab-case(比照 `filter-builder-ui`);co-locate `*.spec.ts(x)`。
- commit/PR:英文 conventional commits,每個 commit 訊息結尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
- **HOLD PR**:全部完成後不開/不合 PR,等人工於 GitHub 合併。
- 所有觸及 `@rfjs/*` 與 `apps/web` 皆為 private package,**不需 changeset**。
- git 指令一律加 `-C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer`,pnpm 一律加 `-C <worktree>` 或 `--filter`,避免動到主 checkout。

> 下文所有相對路徑均相對於 worktree 根目錄 `.claude/worktrees/feat-bpmn-viewer/`。
> 每個 commit 前先 `git -C <worktree> add <files>`。為精簡,步驟中的 `git commit` 省略 worktree 前綴,實際執行時請帶上 `-C <worktree>`。

---

## Task 1: Scaffold `@rfjs/bpmn` 套件 + zoom 純函式

**Files:**
- Create: `packages/bpmn/package.json`
- Create: `packages/bpmn/tsconfig.json`
- Create: `packages/bpmn/vitest.config.mts`
- Create: `packages/bpmn/src/zoom.ts`
- Test: `packages/bpmn/src/zoom.spec.ts`
- Create: `packages/bpmn/src/index.ts`(暫時只 export zoom)

**Interfaces:**
- Produces:
  - `ZOOM_FACTOR: number`、`MIN_ZOOM: number`、`MAX_ZOOM: number`
  - `clampZoom(z: number): number`
  - `zoomBy(current: number, factor: number): number`

- [ ] **Step 1: 建立套件設定檔**

`packages/bpmn/package.json`:

```json
{
  "name": "@rfjs/bpmn",
  "version": "0.0.0",
  "description": "Headless React wrapper around bpmn-js NavigatedViewer (read-only BPMN viewer); consumed via transpilePackages",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest --passWithNoTests --run",
    "vitest:run": "vitest --passWithNoTests --run"
  },
  "dependencies": {
    "bpmn-js": "^18.19.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "jsdom": "^29.1.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "typescript": "6.0.3",
    "typescript-eslint": "^8.61.0",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

`packages/bpmn/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

`packages/bpmn/vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.(ts|tsx)'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

`packages/bpmn/src/index.ts`(先放 zoom,後續 task 補):

```ts
export * from "./zoom";
```

- [ ] **Step 2: 安裝相依、連結 workspace、鎖定 CSS 路徑**

Run:
```bash
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer install
ls /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer/node_modules/bpmn-js/dist/assets
ls /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer/node_modules/bpmn-js/dist/assets/bpmn-font/css
```
Expected: `assets/` 含 `diagram-js.css`、`bpmn-js.css`;`bpmn-font/css/` 含 `bpmn-embedded.css`(若實際檔名不同,於 Task 2 的 CSS import 改用實際檔名)。

- [ ] **Step 3: 寫失敗測試** — `packages/bpmn/src/zoom.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { ZOOM_FACTOR, MIN_ZOOM, MAX_ZOOM, clampZoom, zoomBy } from "./zoom";

describe("zoom helpers", () => {
  it("clamps below min and above max", () => {
    expect(clampZoom(MIN_ZOOM - 1)).toBe(MIN_ZOOM);
    expect(clampZoom(MAX_ZOOM + 1)).toBe(MAX_ZOOM);
    expect(clampZoom(1)).toBe(1);
  });

  it("zoomBy multiplies then clamps", () => {
    expect(zoomBy(1, ZOOM_FACTOR)).toBeCloseTo(ZOOM_FACTOR);
    expect(zoomBy(1, 1 / ZOOM_FACTOR)).toBeCloseTo(1 / ZOOM_FACTOR);
    expect(zoomBy(MAX_ZOOM, ZOOM_FACTOR)).toBe(MAX_ZOOM); // already at max
    expect(zoomBy(MIN_ZOOM, 1 / ZOOM_FACTOR)).toBe(MIN_ZOOM); // already at min
  });
});
```

- [ ] **Step 4: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn vitest:run`
Expected: FAIL —— 找不到 `./zoom` 模組。

- [ ] **Step 5: 實作 `packages/bpmn/src/zoom.ts`**

```ts
/** 縮放係數:每次 zoomIn/zoomOut 乘以或除以此值。 */
export const ZOOM_FACTOR = 1.2;
/** 最小縮放倍率。 */
export const MIN_ZOOM = 0.2;
/** 最大縮放倍率。 */
export const MAX_ZOOM = 4;

/** 把縮放倍率限制在 [MIN_ZOOM, MAX_ZOOM]。 */
export const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** 以 current × factor 計算新倍率並 clamp。 */
export const zoomBy = (current: number, factor: number): number => clampZoom(current * factor);
```

- [ ] **Step 6: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn vitest:run`
Expected: PASS(2 passed)。

- [ ] **Step 7: Commit**

```bash
git add packages/bpmn/package.json packages/bpmn/tsconfig.json packages/bpmn/vitest.config.mts \
  packages/bpmn/src/zoom.ts packages/bpmn/src/zoom.spec.ts packages/bpmn/src/index.ts \
  pnpm-lock.yaml
git commit -m "feat(bpmn): scaffold @rfjs/bpmn package with zoom helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `<BpmnViewer>` 元件 + 型別(mock bpmn-js)

**Files:**
- Create: `packages/bpmn/src/types.ts`
- Create: `packages/bpmn/src/bpmn-viewer.tsx`
- Test: `packages/bpmn/src/bpmn-viewer.spec.tsx`
- Modify: `packages/bpmn/src/index.ts`

**Interfaces:**
- Consumes: `zoomBy`, `ZOOM_FACTOR` from `./zoom`
- Produces:
  - `interface BpmnImportResult { warnings: unknown[] }`
  - `interface BpmnViewerError { message: string; warnings?: unknown[]; cause?: unknown }`
  - `interface BpmnViewerProps { xml: string; options?: Record<string, unknown>; className?: string; style?: React.CSSProperties; onImport?: (r: BpmnImportResult) => void; onError?: (e: BpmnViewerError) => void; onLoadingChange?: (loading: boolean) => void }`
  - `interface BpmnViewerHandle { zoomIn(): void; zoomOut(): void; resetZoom(): void; fitViewport(): void; getZoom(): number; getViewer(): unknown }`
  - `const BpmnViewer: React.ForwardRefExoticComponent<BpmnViewerProps & React.RefAttributes<BpmnViewerHandle>>`

- [ ] **Step 1: 寫型別 `packages/bpmn/src/types.ts`**

```ts
import type { CSSProperties } from "react";

export interface BpmnImportResult {
  warnings: unknown[];
}

export interface BpmnViewerError {
  message: string;
  warnings?: unknown[];
  cause?: unknown;
}

export interface BpmnViewerProps {
  /** 受控的 BPMN 2.0 XML 字串。 */
  xml: string;
  /** 透傳給 NavigatedViewer 建構子的額外選項。 */
  options?: Record<string, unknown>;
  className?: string;
  style?: CSSProperties;
  onImport?: (result: BpmnImportResult) => void;
  onError?: (error: BpmnViewerError) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export interface BpmnViewerHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetZoom(): void;
  fitViewport(): void;
  getZoom(): number;
  /** 逃生艙:回傳底層 NavigatedViewer 實例(未建立時為 null)。 */
  getViewer(): unknown;
}
```

- [ ] **Step 2: 寫失敗測試 `packages/bpmn/src/bpmn-viewer.spec.tsx`**

```tsx
import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BpmnViewer } from "./bpmn-viewer";
import type { BpmnViewerHandle } from "./types";

// 共享的 mock 函式,讓我們跨實例斷言呼叫。
const ctor = vi.fn();
const importXML = vi.fn();
const destroy = vi.fn();
const zoom = vi.fn(() => 1);
const canvas = { zoom };
const get = vi.fn((name: string) => (name === "canvas" ? canvas : undefined));

vi.mock("bpmn-js/lib/NavigatedViewer", () => ({
  default: class MockViewer {
    constructor(opts: unknown) {
      ctor(opts);
    }
    importXML = importXML;
    get = get;
    destroy = destroy;
  },
}));

const XML_A = "<bpmn:a/>";
const XML_B = "<bpmn:b/>";

beforeEach(() => {
  ctor.mockClear();
  importXML.mockReset().mockResolvedValue({ warnings: [] });
  destroy.mockClear();
  zoom.mockReset().mockReturnValue(1);
  get.mockClear();
});

describe("<BpmnViewer>", () => {
  it("creates a NavigatedViewer with a container element on mount", async () => {
    render(<BpmnViewer xml={XML_A} />);
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1));
    const opts = ctor.mock.calls[0]![0] as { container: unknown };
    expect(opts.container).toBeInstanceOf(HTMLElement);
  });

  it("imports the xml and fits the viewport, then calls onImport", async () => {
    const onImport = vi.fn();
    render(<BpmnViewer xml={XML_A} onImport={onImport} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledWith(XML_A));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith({ warnings: [] }));
    expect(zoom).toHaveBeenCalledWith("fit-viewport");
  });

  it("toggles onLoadingChange true then false", async () => {
    const onLoadingChange = vi.fn();
    render(<BpmnViewer xml={XML_A} onLoadingChange={onLoadingChange} />);
    await waitFor(() => expect(onLoadingChange).toHaveBeenCalledWith(false));
    expect(onLoadingChange.mock.calls[0]![0]).toBe(true);
  });

  it("calls onError when importXML rejects", async () => {
    importXML.mockRejectedValueOnce(new Error("bad xml"));
    const onError = vi.fn();
    render(<BpmnViewer xml={XML_A} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0]![0]).toMatchObject({ message: "bad xml" });
  });

  it("re-imports when xml prop changes", async () => {
    const { rerender } = render(<BpmnViewer xml={XML_A} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledWith(XML_A));
    rerender(<BpmnViewer xml={XML_B} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledWith(XML_B));
  });

  it("destroys the viewer on unmount", async () => {
    const { unmount } = render(<BpmnViewer xml={XML_A} />);
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1));
    unmount();
    await waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
  });

  it("exposes imperative zoom handle methods", async () => {
    const ref = createRef<BpmnViewerHandle>();
    render(<BpmnViewer xml={XML_A} ref={ref} />);
    await waitFor(() => expect(ctor).toHaveBeenCalledTimes(1));
    ref.current!.fitViewport();
    expect(zoom).toHaveBeenCalledWith("fit-viewport");
    zoom.mockReturnValue(1);
    ref.current!.zoomIn();
    // zoomIn → zoom(current * ZOOM_FACTOR) = zoom(1.2)
    expect(zoom).toHaveBeenCalledWith(expect.closeTo(1.2, 5));
    expect(ref.current!.getZoom()).toBe(1);
  });

  it("ignores a stale import result when a newer import supersedes it", async () => {
    // 第一次 import 延遲解析,第二次先解析 → 只有第二次的 onImport 生效。
    let resolveFirst!: (v: { warnings: unknown[] }) => void;
    importXML
      .mockImplementationOnce(() => new Promise((res) => (resolveFirst = res)))
      .mockResolvedValueOnce({ warnings: ["second"] });
    const onImport = vi.fn();
    const { rerender } = render(<BpmnViewer xml={XML_A} onImport={onImport} />);
    await waitFor(() => expect(importXML).toHaveBeenCalledTimes(1));
    rerender(<BpmnViewer xml={XML_B} onImport={onImport} />);
    await waitFor(() => expect(onImport).toHaveBeenCalledWith({ warnings: ["second"] }));
    // 現在才解析第一次(過期)—— 不應再觸發 onImport。
    resolveFirst({ warnings: ["first"] });
    await new Promise((r) => setTimeout(r, 0));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalledWith({ warnings: ["first"] });
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn vitest:run`
Expected: FAIL —— 找不到 `./bpmn-viewer`。

- [ ] **Step 4: 實作 `packages/bpmn/src/bpmn-viewer.tsx`**

> CSS import 路徑若 Task 1 Step 2 實測檔名不同,改成實測值。

```tsx
"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

import { ZOOM_FACTOR, zoomBy } from "./zoom";
import type { BpmnViewerError, BpmnViewerHandle, BpmnViewerProps } from "./types";

interface BpmnCanvas {
  zoom(level?: number | string, center?: unknown): number;
}
interface BpmnInstance {
  importXML(xml: string): Promise<{ warnings?: unknown[] }>;
  get(name: string): unknown;
  destroy(): void;
}

export const BpmnViewer = forwardRef<BpmnViewerHandle, BpmnViewerProps>(
  function BpmnViewer({ xml, options, className, style, onImport, onError, onLoadingChange }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<BpmnInstance | null>(null);
    const importSeq = useRef(0);
    const [ready, setReady] = useState(false);

    // 把最新 callback 收進 ref,避免 inline callback 造成 import effect 反覆重跑。
    const cbRef = useRef({ onImport, onError, onLoadingChange });
    cbRef.current = { onImport, onError, onLoadingChange };

    // 建立 / 銷毀 viewer(client-only;動態 import 確保 SSR 不觸碰 bpmn-js)。
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      let cancelled = false;
      let created: BpmnInstance | null = null;

      void (async () => {
        const mod = await import("bpmn-js/lib/NavigatedViewer");
        if (cancelled) return;
        const NavigatedViewer = mod.default as new (opts: Record<string, unknown>) => BpmnInstance;
        created = new NavigatedViewer({ container, ...(options ?? {}) });
        viewerRef.current = created;
        setReady(true);
      })();

      return () => {
        cancelled = true;
        if (created) created.destroy();
        viewerRef.current = null;
        setReady(false);
      };
    }, [options]);

    // viewer 就緒或 xml 變更 → import(含競態保護)。
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!ready || !viewer || !xml) return;
      const seq = ++importSeq.current;
      cbRef.current.onLoadingChange?.(true);
      viewer
        .importXML(xml)
        .then((result) => {
          if (seq !== importSeq.current) return;
          cbRef.current.onLoadingChange?.(false);
          (viewer.get("canvas") as BpmnCanvas).zoom("fit-viewport");
          cbRef.current.onImport?.({ warnings: result?.warnings ?? [] });
        })
        .catch((err: unknown) => {
          if (seq !== importSeq.current) return;
          cbRef.current.onLoadingChange?.(false);
          const e: BpmnViewerError = {
            message: err instanceof Error ? err.message : String(err),
            warnings: (err as { warnings?: unknown[] })?.warnings,
            cause: err,
          };
          cbRef.current.onError?.(e);
        });
    }, [ready, xml]);

    useImperativeHandle(
      ref,
      (): BpmnViewerHandle => {
        const canvas = (): BpmnCanvas | null =>
          (viewerRef.current?.get("canvas") as BpmnCanvas | undefined) ?? null;
        return {
          zoomIn() {
            const c = canvas();
            if (c) c.zoom(zoomBy(c.zoom(), ZOOM_FACTOR));
          },
          zoomOut() {
            const c = canvas();
            if (c) c.zoom(zoomBy(c.zoom(), 1 / ZOOM_FACTOR));
          },
          resetZoom() {
            canvas()?.zoom("fit-viewport");
          },
          fitViewport() {
            canvas()?.zoom("fit-viewport");
          },
          getZoom() {
            return canvas()?.zoom() ?? 1;
          },
          getViewer() {
            return viewerRef.current;
          },
        };
      },
      [ready],
    );

    return <div ref={containerRef} className={className} style={style} />;
  },
);
```

- [ ] **Step 5: 更新 barrel `packages/bpmn/src/index.ts`**

```ts
export * from "./zoom";
export * from "./types";
export * from "./bpmn-viewer";
```

- [ ] **Step 6: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn vitest:run`
Expected: PASS(zoom 2 + viewer 8 = 10 passed)。

- [ ] **Step 7: typecheck**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn check-types`
Expected: 無錯誤。

- [ ] **Step 8: Commit**

```bash
git add packages/bpmn/src/types.ts packages/bpmn/src/bpmn-viewer.tsx \
  packages/bpmn/src/bpmn-viewer.spec.tsx packages/bpmn/src/index.ts
git commit -m "feat(bpmn): add headless BpmnViewer component over NavigatedViewer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `useBpmnViewer` hook

**Files:**
- Create: `packages/bpmn/src/use-bpmn-viewer.ts`
- Test: `packages/bpmn/src/use-bpmn-viewer.spec.ts`
- Modify: `packages/bpmn/src/index.ts`

**Interfaces:**
- Consumes: `BpmnViewerHandle`, `BpmnViewerError` from `./types`
- Produces:
  - `interface UseBpmnViewer { viewerProps: { ref: React.RefObject<BpmnViewerHandle | null>; onLoadingChange: (loading: boolean) => void; onError: (error: BpmnViewerError) => void }; zoomIn: () => void; zoomOut: () => void; resetZoom: () => void; fitViewport: () => void; importing: boolean; error: BpmnViewerError | null }`
  - `function useBpmnViewer(): UseBpmnViewer`

- [ ] **Step 1: 寫失敗測試 `packages/bpmn/src/use-bpmn-viewer.spec.ts`**

```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBpmnViewer } from "./use-bpmn-viewer";
import type { BpmnViewerHandle } from "./types";

describe("useBpmnViewer", () => {
  it("returns viewerProps with a ref and the two handlers", () => {
    const { result } = renderHook(() => useBpmnViewer());
    expect(result.current.viewerProps).toHaveProperty("ref");
    expect(typeof result.current.viewerProps.onLoadingChange).toBe("function");
    expect(typeof result.current.viewerProps.onError).toBe("function");
  });

  it("proxies zoom actions to the attached ref handle", () => {
    const { result } = renderHook(() => useBpmnViewer());
    const handle: BpmnViewerHandle = {
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      resetZoom: vi.fn(),
      fitViewport: vi.fn(),
      getZoom: vi.fn(() => 1),
      getViewer: vi.fn(() => null),
    };
    result.current.viewerProps.ref.current = handle;
    act(() => result.current.zoomIn());
    act(() => result.current.fitViewport());
    expect(handle.zoomIn).toHaveBeenCalledTimes(1);
    expect(handle.fitViewport).toHaveBeenCalledTimes(1);
  });

  it("tracks importing state and clears error when a new load starts", () => {
    const { result } = renderHook(() => useBpmnViewer());
    act(() => result.current.viewerProps.onError({ message: "x" }));
    expect(result.current.error).toEqual({ message: "x" });
    act(() => result.current.viewerProps.onLoadingChange(true));
    expect(result.current.importing).toBe(true);
    expect(result.current.error).toBeNull();
    act(() => result.current.viewerProps.onLoadingChange(false));
    expect(result.current.importing).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn vitest:run`
Expected: FAIL —— 找不到 `./use-bpmn-viewer`。

- [ ] **Step 3: 實作 `packages/bpmn/src/use-bpmn-viewer.ts`**

```ts
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { BpmnViewerError, BpmnViewerHandle } from "./types";

export interface UseBpmnViewer {
  /** 直接 spread 到 <BpmnViewer> 的 props(ref + 內部 handler)。 */
  viewerProps: {
    ref: RefObject<BpmnViewerHandle | null>;
    onLoadingChange: (loading: boolean) => void;
    onError: (error: BpmnViewerError) => void;
  };
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitViewport: () => void;
  importing: boolean;
  error: BpmnViewerError | null;
}

export function useBpmnViewer(): UseBpmnViewer {
  const ref = useRef<BpmnViewerHandle | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<BpmnViewerError | null>(null);

  const onLoadingChange = useCallback((loading: boolean) => {
    setImporting(loading);
    if (loading) setError(null);
  }, []);
  const onError = useCallback((e: BpmnViewerError) => setError(e), []);

  const zoomIn = useCallback(() => ref.current?.zoomIn(), []);
  const zoomOut = useCallback(() => ref.current?.zoomOut(), []);
  const resetZoom = useCallback(() => ref.current?.resetZoom(), []);
  const fitViewport = useCallback(() => ref.current?.fitViewport(), []);

  const viewerProps = useMemo(
    () => ({ ref, onLoadingChange, onError }),
    [onLoadingChange, onError],
  );

  return { viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error };
}
```

- [ ] **Step 4: 更新 barrel** — 在 `packages/bpmn/src/index.ts` 末尾加:

```ts
export * from "./use-bpmn-viewer";
```

- [ ] **Step 5: 跑測試 + typecheck 確認通過**

Run: `pnpm -C <worktree> --filter @rfjs/bpmn vitest:run && pnpm -C <worktree> --filter @rfjs/bpmn check-types`
Expected: PASS(13 passed)、typecheck 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add packages/bpmn/src/use-bpmn-viewer.ts packages/bpmn/src/use-bpmn-viewer.spec.ts packages/bpmn/src/index.ts
git commit -m "feat(bpmn): add useBpmnViewer hook wrapping the ref handle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 套件 README + lint 綠燈(套件完成 gate)

**Files:**
- Create: `packages/bpmn/README.md`
- Create: `packages/bpmn/README.zh-TW.md`

**Interfaces:** 無新增程式介面。

- [ ] **Step 1: 寫 `packages/bpmn/README.md`**

````markdown
# @rfjs/bpmn

Headless React wrapper around [`bpmn-js`](https://github.com/bpmn-io/bpmn-js) `NavigatedViewer` — a read-only BPMN 2.0 diagram viewer. Private workspace package, consumed via Next.js `transpilePackages` (no build step).

> **License:** `bpmn-js` is distributed under the [bpmn.io license](https://bpmn.io/license/). The viewer renders a "Powered by bpmn.io" badge; **do not hide it**.

## Usage

```tsx
import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn";

function Demo({ xml }: { xml: string }) {
  const v = useBpmnViewer();
  return (
    <div>
      <button onClick={v.zoomIn}>+</button>
      <button onClick={v.zoomOut}>-</button>
      <button onClick={v.fitViewport}>fit</button>
      <BpmnViewer {...v.viewerProps} xml={xml} className="h-[600px] w-full" />
      {v.error && <p role="alert">{v.error.message}</p>}
    </div>
  );
}
```

## API

- `<BpmnViewer xml options className style onImport onError onLoadingChange ref />` — controlled component. The `ref` exposes `BpmnViewerHandle` (`zoomIn`/`zoomOut`/`resetZoom`/`fitViewport`/`getZoom`/`getViewer`).
- `useBpmnViewer()` — returns `{ viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error }`. Spread `viewerProps` onto `<BpmnViewer>`.

The container needs an explicit height to render.
````

- [ ] **Step 2: 寫 `packages/bpmn/README.zh-TW.md`**

````markdown
# @rfjs/bpmn

封裝 [`bpmn-js`](https://github.com/bpmn-io/bpmn-js) `NavigatedViewer` 的無頭 React 元件 —— 唯讀 BPMN 2.0 流程圖檢視器。Private workspace 套件,透過 Next.js `transpilePackages` 消費(無 build step)。

> **授權:** `bpmn-js` 採用 [bpmn.io 授權](https://bpmn.io/license/)。檢視器會顯示「Powered by bpmn.io」標誌,**請勿隱藏**。

## 用法

```tsx
import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn";

function Demo({ xml }: { xml: string }) {
  const v = useBpmnViewer();
  return (
    <div>
      <button onClick={v.zoomIn}>+</button>
      <button onClick={v.fitViewport}>fit</button>
      <BpmnViewer {...v.viewerProps} xml={xml} className="h-[600px] w-full" />
      {v.error && <p role="alert">{v.error.message}</p>}
    </div>
  );
}
```

## API

- `<BpmnViewer>` —— 受控元件;`ref` 提供 `BpmnViewerHandle`(`zoomIn`/`zoomOut`/`resetZoom`/`fitViewport`/`getZoom`/`getViewer`)。
- `useBpmnViewer()` —— 回傳 `{ viewerProps, zoomIn, zoomOut, resetZoom, fitViewport, importing, error }`;把 `viewerProps` spread 到 `<BpmnViewer>`。

容器需有明確高度才能渲染。
````

- [ ] **Step 3: lint + 全套件測試 + typecheck 綠燈**

Run:
```bash
pnpm -C <worktree> --filter @rfjs/bpmn lint
pnpm -C <worktree> --filter @rfjs/bpmn check-types
pnpm -C <worktree> --filter @rfjs/bpmn vitest:run
```
Expected: lint 0 warning、typecheck 無錯誤、測試 13 passed。

> 若 lint 因 eslint 設定缺檔報錯,比照 `packages/filter-builder-ui` 補上相同的 eslint flat config(`eslint.config.mjs`);沿用其內容。

- [ ] **Step 4: Commit**

```bash
git add packages/bpmn/README.md packages/bpmn/README.zh-TW.md
git commit -m "docs(bpmn): add @rfjs/bpmn README (en + zh-TW)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: 展示頁範例資料 `samples.ts`

**Files:**
- Create: `apps/web/src/tools/bpmn-viewer/samples.ts`
- Test: `apps/web/src/tools/bpmn-viewer/samples.spec.ts`

**Interfaces:**
- Produces:
  - `interface BpmnSample { id: string; label: string; xml: string }`
  - `const SAMPLES: BpmnSample[]`(至少 2 筆)
  - `const DEFAULT_SAMPLE_ID: string`
  - `function getSample(id: string): BpmnSample | undefined`

- [ ] **Step 1: 寫失敗測試 `apps/web/src/tools/bpmn-viewer/samples.spec.ts`**

```ts
import { describe, expect, it } from "vitest";

import { SAMPLES, DEFAULT_SAMPLE_ID, getSample } from "./samples";

describe("bpmn samples", () => {
  it("ships at least two samples, each a valid-looking BPMN diagram", () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(2);
    for (const s of SAMPLES) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.xml).toContain("<bpmn:definitions");
      expect(s.xml).toContain("bpmndi:BPMNDiagram"); // 需有 DI 才畫得出版面
    }
  });

  it("has unique ids and a resolvable default", () => {
    const ids = SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getSample(DEFAULT_SAMPLE_ID)).toBeDefined();
    expect(getSample("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- samples`
Expected: FAIL —— 找不到 `./samples`。

- [ ] **Step 3: 實作 `apps/web/src/tools/bpmn-viewer/samples.ts`**

```ts
export interface BpmnSample {
  id: string;
  label: string;
  xml: string;
}

const LEAVE_REQUEST = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_Leave" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LeaveRequest" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Submit request"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_1" name="Manager review"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="End_1" name="Notified"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_Leave">
    <bpmndi:BPMNPlane id="Plane_Leave" bpmnElement="LeaveRequest">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="152" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="240" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="392" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="188" y="120" /><di:waypoint x="240" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="340" y="120" /><di:waypoint x="392" y="120" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const ORDER_APPROVAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_Order" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="OrderApproval" isExecutable="false">
    <bpmn:startEvent id="O_Start" name="Order placed"><bpmn:outgoing>O_F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="O_Gw" name="Amount > 1000?"><bpmn:incoming>O_F1</bpmn:incoming><bpmn:outgoing>O_F2</bpmn:outgoing><bpmn:outgoing>O_F3</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="O_Review" name="Manual review"><bpmn:incoming>O_F2</bpmn:incoming><bpmn:outgoing>O_F4</bpmn:outgoing></bpmn:task>
    <bpmn:endEvent id="O_Auto" name="Auto-approved"><bpmn:incoming>O_F3</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="O_Done" name="Approved"><bpmn:incoming>O_F4</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="O_F1" sourceRef="O_Start" targetRef="O_Gw" />
    <bpmn:sequenceFlow id="O_F2" name="yes" sourceRef="O_Gw" targetRef="O_Review" />
    <bpmn:sequenceFlow id="O_F3" name="no" sourceRef="O_Gw" targetRef="O_Auto" />
    <bpmn:sequenceFlow id="O_F4" sourceRef="O_Review" targetRef="O_Done" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_Order">
    <bpmndi:BPMNPlane id="Plane_Order" bpmnElement="OrderApproval">
      <bpmndi:BPMNShape id="O_Start_di" bpmnElement="O_Start"><dc:Bounds x="152" y="142" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Gw_di" bpmnElement="O_Gw" isMarkerVisible="true"><dc:Bounds x="245" y="135" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Review_di" bpmnElement="O_Review"><dc:Bounds x="360" y="120" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Auto_di" bpmnElement="O_Auto"><dc:Bounds x="392" y="252" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="O_Done_di" bpmnElement="O_Done"><dc:Bounds x="512" y="142" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="O_F1_di" bpmnElement="O_F1"><di:waypoint x="188" y="160" /><di:waypoint x="245" y="160" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="O_F2_di" bpmnElement="O_F2"><di:waypoint x="295" y="160" /><di:waypoint x="360" y="160" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="O_F3_di" bpmnElement="O_F3"><di:waypoint x="270" y="185" /><di:waypoint x="270" y="270" /><di:waypoint x="392" y="270" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="O_F4_di" bpmnElement="O_F4"><di:waypoint x="460" y="160" /><di:waypoint x="512" y="160" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const SAMPLES: BpmnSample[] = [
  { id: "leave-request", label: "Leave Request", xml: LEAVE_REQUEST },
  { id: "order-approval", label: "Order Approval", xml: ORDER_APPROVAL },
];

export const DEFAULT_SAMPLE_ID = "leave-request";

export function getSample(id: string): BpmnSample | undefined {
  return SAMPLES.find((s) => s.id === id);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- samples`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/bpmn-viewer/samples.ts apps/web/src/tools/bpmn-viewer/samples.spec.ts
git commit -m "feat(web): add bundled BPMN samples for bpmn-viewer tool

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 檔案上傳驗證 `file-input.ts`

**Files:**
- Create: `apps/web/src/tools/bpmn-viewer/file-input.ts`
- Test: `apps/web/src/tools/bpmn-viewer/file-input.spec.ts`

**Interfaces:**
- Produces:
  - `const MAX_BPMN_BYTES = 1048576`(1 MiB)
  - `const ALLOWED_BPMN_EXTENSIONS: readonly string[]`(`[".bpmn", ".xml"]`)
  - `interface BpmnFileMeta { name: string; size: number }`
  - `type BpmnFileValidation = { ok: true } | { ok: false; reason: "extension" | "size" | "empty" }`
  - `function validateBpmnFile(meta: BpmnFileMeta): BpmnFileValidation`

- [ ] **Step 1: 寫失敗測試 `apps/web/src/tools/bpmn-viewer/file-input.spec.ts`**

```ts
import { describe, expect, it } from "vitest";

import { validateBpmnFile, MAX_BPMN_BYTES } from "./file-input";

describe("validateBpmnFile", () => {
  it("accepts .bpmn and .xml within the size limit", () => {
    expect(validateBpmnFile({ name: "flow.bpmn", size: 100 })).toEqual({ ok: true });
    expect(validateBpmnFile({ name: "flow.xml", size: 100 })).toEqual({ ok: true });
    expect(validateBpmnFile({ name: "FLOW.BPMN", size: 100 })).toEqual({ ok: true }); // 大小寫不敏感
  });

  it("rejects disallowed extensions", () => {
    expect(validateBpmnFile({ name: "flow.pdf", size: 100 })).toEqual({ ok: false, reason: "extension" });
    expect(validateBpmnFile({ name: "noext", size: 100 })).toEqual({ ok: false, reason: "extension" });
  });

  it("rejects empty and oversized files", () => {
    expect(validateBpmnFile({ name: "flow.bpmn", size: 0 })).toEqual({ ok: false, reason: "empty" });
    expect(validateBpmnFile({ name: "flow.bpmn", size: MAX_BPMN_BYTES + 1 })).toEqual({ ok: false, reason: "size" });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- file-input`
Expected: FAIL。

- [ ] **Step 3: 實作 `apps/web/src/tools/bpmn-viewer/file-input.ts`**

```ts
/** 上傳 BPMN 檔案大小上限:1 MiB。 */
export const MAX_BPMN_BYTES = 1024 * 1024;
/** 允許的副檔名(小寫)。 */
export const ALLOWED_BPMN_EXTENSIONS = [".bpmn", ".xml"] as const;

export interface BpmnFileMeta {
  name: string;
  size: number;
}

export type BpmnFileValidation = { ok: true } | { ok: false; reason: "extension" | "size" | "empty" };

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_BPMN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateBpmnFile(meta: BpmnFileMeta): BpmnFileValidation {
  if (!hasAllowedExtension(meta.name)) return { ok: false, reason: "extension" };
  if (meta.size <= 0) return { ok: false, reason: "empty" };
  if (meta.size > MAX_BPMN_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- file-input`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/tools/bpmn-viewer/file-input.ts apps/web/src/tools/bpmn-viewer/file-input.spec.ts
git commit -m "feat(web): add bpmn file-upload validation helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: 展示頁元件 `ui.tsx` + `messages.ts` + `index.ts`

**先決:** 此 task 的測試會 import `@rfjs/bpmn`,故先把它加進 apps/web 相依並 install。

**Files:**
- Modify: `apps/web/package.json`(加 `"@rfjs/bpmn": "workspace:*"` 到 `dependencies`)
- Create: `apps/web/src/tools/bpmn-viewer/messages.ts`
- Create: `apps/web/src/tools/bpmn-viewer/ui.tsx`
- Create: `apps/web/src/tools/bpmn-viewer/index.ts`
- Test: `apps/web/src/tools/bpmn-viewer/ui.spec.tsx`

**Interfaces:**
- Consumes: `BpmnViewer`, `useBpmnViewer` from `@rfjs/bpmn`;`SAMPLES`, `DEFAULT_SAMPLE_ID`, `getSample` from `./samples`;`validateBpmnFile` from `./file-input`
- Produces:
  - `const messages: LocaleMessages`(含 `Tools["bpmn-viewer"]` 與 `ToolUI` 的 `bpmn*` 前綴鍵)
  - `function BpmnViewerTool(): JSX.Element`
  - `const tool: ToolModule = { id: "bpmn-viewer", Component: BpmnViewerTool }`

- [ ] **Step 1: 加相依並 install**

修改 `apps/web/package.json` 的 `dependencies`,加入(依字母序放在 `@rfjs/*` 區塊頂部即可):

```json
    "@rfjs/bpmn": "workspace:*",
```

Run:
```bash
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer install
```
Expected: 成功連結 workspace。

- [ ] **Step 2: 寫 `apps/web/src/tools/bpmn-viewer/messages.ts`**

```ts
import type { LocaleMessages } from "@/tools/types";

export const messages: LocaleMessages = {
  en: {
    Tools: {
      "bpmn-viewer": {
        title: "BPMN Viewer",
        description:
          "Render read-only BPMN 2.0 process diagrams from XML — pick a sample, paste XML, or upload a .bpmn file, then zoom and fit.",
      },
    },
    ToolUI: {
      bpmnEyebrow: "BPMN VIEWER",
      bpmnSample: "Sample",
      bpmnUpload: "Upload .bpmn",
      bpmnPasteLabel: "Paste BPMN XML",
      bpmnApply: "Render",
      bpmnZoomIn: "Zoom in",
      bpmnZoomOut: "Zoom out",
      bpmnReset: "Reset",
      bpmnFit: "Fit",
      bpmnErrExtension: "Unsupported file type — use .bpmn or .xml",
      bpmnErrSize: "File too large (max 1 MB)",
      bpmnErrEmpty: "File is empty",
      bpmnErrImport: "Could not render this diagram — the XML may be invalid",
    },
  },
  "zh-TW": {
    Tools: {
      "bpmn-viewer": {
        title: "BPMN 檢視器",
        description:
          "從 XML 渲染唯讀的 BPMN 2.0 流程圖 —— 選範例、貼上 XML 或上傳 .bpmn 檔,再縮放與 fit。",
      },
    },
    ToolUI: {
      bpmnEyebrow: "BPMN 檢視器",
      bpmnSample: "範例",
      bpmnUpload: "上傳 .bpmn",
      bpmnPasteLabel: "貼上 BPMN XML",
      bpmnApply: "渲染",
      bpmnZoomIn: "放大",
      bpmnZoomOut: "縮小",
      bpmnReset: "重設",
      bpmnFit: "符合畫面",
      bpmnErrExtension: "不支援的檔案類型 —— 請用 .bpmn 或 .xml",
      bpmnErrSize: "檔案過大(上限 1 MB)",
      bpmnErrEmpty: "檔案是空的",
      bpmnErrImport: "無法渲染此圖 —— XML 可能無效",
    },
  },
};
```

- [ ] **Step 3: 寫失敗測試 `apps/web/src/tools/bpmn-viewer/ui.spec.tsx`**

> 頂部的 jsdom shim 與 form-designer 測試一致(radix Select 需要)。`@rfjs/bpmn` 整個被 mock,避免在 jsdom 跑真 bpmn-js。

```tsx
// jsdom shim: radix-ui Select 需要 pointer capture / scrollIntoView。
if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rfjs/bpmn", () => ({
  BpmnViewer: ({ xml }: { xml: string }) => <div data-testid="bpmn-viewer" data-xml={xml} />,
  useBpmnViewer: () => ({
    viewerProps: { ref: { current: null }, onLoadingChange: () => {}, onError: () => {} },
    zoomIn: () => {},
    zoomOut: () => {},
    resetZoom: () => {},
    fitViewport: () => {},
    importing: false,
    error: null,
  }),
}));

import { messages } from "./messages";
import { BpmnViewerTool } from "./ui";

function renderTool() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en as Record<string, unknown>}>
      <BpmnViewerTool />
    </NextIntlClientProvider>,
  );
}

describe("BpmnViewerTool", () => {
  it("renders the default sample into the viewer", () => {
    renderTool();
    const viewer = screen.getByTestId("bpmn-viewer");
    expect(viewer.getAttribute("data-xml")).toContain("<bpmn:definitions");
  });

  it("renders pasted XML when Render is clicked", () => {
    renderTool();
    const textarea = screen.getByLabelText(/paste bpmn xml/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "<bpmn:definitions id='X'/>" } });
    fireEvent.click(screen.getByRole("button", { name: /^render$/i }));
    expect(screen.getByTestId("bpmn-viewer").getAttribute("data-xml")).toContain("id='X'");
  });

  it("shows an error for an unsupported uploaded file type", () => {
    renderTool();
    const file = new File(["data"], "notes.pdf", { type: "application/pdf" });
    const input = screen.getByTestId("bpmn-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("alert").textContent).toMatch(/unsupported file type/i);
  });
});
```

- [ ] **Step 4: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- bpmn-viewer/ui`
Expected: FAIL —— 找不到 `./ui`。

- [ ] **Step 5: 寫 `apps/web/src/tools/bpmn-viewer/ui.tsx`**

```tsx
"use client";

import * as React from "react";
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { BpmnViewer, useBpmnViewer } from "@rfjs/bpmn";
import { Button } from "@rfjs/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rfjs/web-ui/components/select";

import { SAMPLES, DEFAULT_SAMPLE_ID, getSample } from "./samples";
import { validateBpmnFile } from "./file-input";

export function BpmnViewerTool() {
  const t = useTranslations("ToolUI");
  const v = useBpmnViewer();

  const [xml, setXml] = React.useState(() => getSample(DEFAULT_SAMPLE_ID)?.xml ?? "");
  const [paste, setPaste] = React.useState("");
  const [inputError, setInputError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onSelectSample = (id: string) => {
    const s = getSample(id);
    if (!s) return;
    setInputError(null);
    setXml(s.xml);
  };

  const onApplyPaste = () => {
    if (!paste.trim()) return;
    setInputError(null);
    setXml(paste);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = validateBpmnFile({ name: file.name, size: file.size });
    if (!result.ok) {
      setInputError(
        result.reason === "extension"
          ? t("bpmnErrExtension")
          : result.reason === "size"
            ? t("bpmnErrSize")
            : t("bpmnErrEmpty"),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setInputError(null);
      setXml(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  const error = inputError ?? (v.error ? t("bpmnErrImport") : null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground">{t("bpmnEyebrow")}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Select defaultValue={DEFAULT_SAMPLE_ID} onValueChange={onSelectSample}>
          <SelectTrigger className="w-48" aria-label={t("bpmnSample")}>
            <SelectValue placeholder={t("bpmnSample")} />
          </SelectTrigger>
          <SelectContent>
            {SAMPLES.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-4 w-4" />
          {t("bpmnUpload")}
        </Button>
        <input
          ref={fileRef}
          data-testid="bpmn-file-input"
          type="file"
          accept=".bpmn,.xml"
          className="hidden"
          onChange={onFile}
        />

        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={t("bpmnZoomIn")} onClick={v.zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t("bpmnZoomOut")} onClick={v.zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t("bpmnReset")} onClick={v.resetZoom}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t("bpmnFit")} onClick={v.fitViewport}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <BpmnViewer
        {...v.viewerProps}
        xml={xml}
        className="h-[600px] w-full rounded-md border bg-card"
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="bpmn-paste" className="text-sm font-medium">
          {t("bpmnPasteLabel")}
        </label>
        <textarea
          id="bpmn-paste"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={5}
          className="w-full rounded-md border bg-background p-2 font-mono text-xs"
          placeholder="<bpmn:definitions ...>"
        />
        <div>
          <Button size="sm" onClick={onApplyPaste}>
            {t("bpmnApply")}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 寫 `apps/web/src/tools/bpmn-viewer/index.ts`**

```ts
import type { ToolModule } from "@/tools/types";

import { BpmnViewerTool } from "./ui";

export const tool: ToolModule = { id: "bpmn-viewer", Component: BpmnViewerTool };
```

- [ ] **Step 7: 跑測試確認通過**

Run: `pnpm -C <worktree> --filter web vitest:run -- bpmn-viewer/ui`
Expected: PASS(3 passed)。

> 若 `@rfjs/web-ui/components/select` 或 `button` 的實際匯出名稱/路徑不同,以 `packages/filter-builder-ui/src/filter-tree-editor.tsx` 的實際 import 為準調整。

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/src/tools/bpmn-viewer/messages.ts \
  apps/web/src/tools/bpmn-viewer/ui.tsx apps/web/src/tools/bpmn-viewer/index.ts \
  apps/web/src/tools/bpmn-viewer/ui.spec.tsx pnpm-lock.yaml
git commit -m "feat(web): add bpmn-viewer tool UI (toolbar, samples, upload, paste)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 註冊 tool(registry + 聚合器 + transpilePackages)

**Files:**
- Modify: `packages/web-core/src/registry/tools.ts`(append tool 一筆)
- Modify: `packages/web-core/src/registry/packages.ts`(append package catalog 一筆 —— `registry.spec.ts` 要求每個 `relatedPackages` 都存在於 `packageRegistry`)
- Modify: `apps/web/src/tools/index.ts`(import + 加入 `toolModules`)
- Modify: `apps/web/src/tools/messages.ts`(import + 加入 `toolMessages`)
- Modify: `apps/web/src/tools/index.spec.ts`(`EXPECTED_WEB_TOOL_IDS` 加 `"bpmn-viewer"`)
- Modify: `apps/web/next.config.js`(`transpilePackages` 加 `"@rfjs/bpmn"`)

**Interfaces:**
- Consumes: `tool`、`messages` from `./bpmn-viewer`(Task 7)

- [ ] **Step 1: 先改測試(EXPECTED ids)讓它失敗** — `apps/web/src/tools/index.spec.ts`

在 `EXPECTED_WEB_TOOL_IDS` 陣列(form-designer 之後)加一行:

```ts
  "form-designer",
  "bpmn-viewer",
].sort();
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -C <worktree> --filter web vitest:run -- tools/index`
Expected: FAIL —— `toolModules` 尚未含 `bpmn-viewer`(且 catalog 也缺)。

- [ ] **Step 3: web-core registry append** — `packages/web-core/src/registry/tools.ts`

在 `form-designer` 條目之後、`object-transformer`(workbench)之前插入:

```ts
  {
    id: 'bpmn-viewer',
    category: 'inspect',
    surface: 'web',
    status: 'preview',
    relatedPackages: ['@rfjs/bpmn'],
    tags: ['diagram', 'bpmn', 'workflow', 'viewer'],
  },
```

- [ ] **Step 3b: web-core package catalog append** — `packages/web-core/src/registry/packages.ts`

在 `packageRegistry` 陣列(例如 `@rfjs/form-builder` 條目之後)插入一筆。**私有套件,不放 `npm`**(比照 `@rfjs/data-label`/`@rfjs/form-builder`):

```ts
  {
    name: '@rfjs/bpmn',
    status: 'preview',
    href: '/packages/bpmn',
    github: GITHUB,
    tags: ['bpmn', 'diagram', 'viewer'],
    relatedTools: ['bpmn-viewer'],
  },
```

> 這同時滿足 `registry.spec.ts` 的兩條斷言:`relatedPackages all exist in packageRegistry`(tool → package)與 `relatedTools all exist in toolRegistry`(package → tool)。`/packages/bpmn` 由 registry slug 自動產生詳情頁,無需額外內容檔。

- [ ] **Step 4: 聚合器 `apps/web/src/tools/index.ts`**

加 import(放在 `formDesigner` 之後):
```ts
import { tool as bpmnViewer } from "./bpmn-viewer";
```
加入陣列(`formDesigner` 之後):
```ts
  formDesigner,
  bpmnViewer,
];
```

- [ ] **Step 5: 聚合器 `apps/web/src/tools/messages.ts`**

加 import(放在 `formDesigner` 之後):
```ts
import { messages as bpmnViewer } from "./bpmn-viewer/messages";
```
加入陣列(`formDesigner` 之後):
```ts
  formDesigner,
  bpmnViewer,
];
```

- [ ] **Step 6: `apps/web/next.config.js` 的 `transpilePackages` 加 `@rfjs/bpmn`**

在 `transpilePackages` 陣列加入 `"@rfjs/bpmn"`(任意位置),例如:
```js
  transpilePackages: [
    "@rfjs/web-ui",
    "@rfjs/web-core",
    "@rfjs/filter-builder-ui",
    "@rfjs/form-builder-ui",
    "@rfjs/bpmn",
  ],
```

> 若 `apps/web/next.config.js` 實際檔名為 `next.config.mjs`/`next.config.ts`,改該檔。**不需** 改 `globals.css` 的 `@source`(套件無 Tailwind)。

- [ ] **Step 7: 跑 tool 註冊測試 + web-core 測試確認通過**

Run:
```bash
pnpm -C <worktree> --filter web vitest:run -- tools/index
pnpm -C <worktree> --filter @rfjs/web-core test
```
Expected: PASS —— `registers exactly the expected web tools`、`every registered component id exists in the web-core catalog`、`component and message aggregators cover the same ids`、`tool ToolUI keys never collide` 全綠;web-core registry schema 驗證通過。

- [ ] **Step 8: Commit**

```bash
git add packages/web-core/src/registry/tools.ts packages/web-core/src/registry/packages.ts \
  apps/web/src/tools/index.ts apps/web/src/tools/messages.ts \
  apps/web/src/tools/index.spec.ts apps/web/next.config.js
git commit -m "feat(web): register bpmn-viewer tool in registry and aggregators

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Playwright e2e 真 SVG 煙霧測試(net-new infra)

> 此 task 引入全新的 `@playwright/test` 基礎設施(repo 既有的 e2e 都是 vitest,非瀏覽器)。需下載 chromium。若執行環境無法下載瀏覽器,記錄為已知限制並改於 Task 10 以手動截圖驗證真渲染;但預設照此 task 完成。

**Files:**
- Modify: `apps/web/package.json`(加 `@playwright/test` devDep + `test:e2e` script)
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/bpmn-viewer.e2e.ts`
- Modify: `apps/web/.gitignore`(若無,建立;忽略 `test-results/`、`playwright-report/`)

**Interfaces:** 無程式介面;純測試。

- [ ] **Step 1: 加 devDep 與 script,並安裝瀏覽器**

修改 `apps/web/package.json`:`devDependencies` 加 `"@playwright/test": "^1.49.0"`;`scripts` 加 `"test:e2e": "playwright test"`。

Run:
```bash
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer install
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer --filter web exec playwright install chromium
```
Expected: 安裝成功(chromium 下載)。

- [ ] **Step 2: 建 `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: 建 `apps/web/e2e/bpmn-viewer.e2e.ts`**

```ts
import { test, expect } from "@playwright/test";

const URL = "/en/tools/bpmn-viewer";

test("renders the default BPMN diagram as SVG", async ({ page }) => {
  await page.goto(URL);
  // bpmn-js 在 .djs-container 內渲染 SVG;預設範例至少含一個形狀。
  const shapes = page.locator(".djs-container svg .djs-element");
  await expect(shapes.first()).toBeVisible({ timeout: 15_000 });
});

test("keeps the bpmn.io attribution badge visible (license)", async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator(".bjs-powered-by")).toBeVisible({ timeout: 15_000 });
});

test("shows an error panel for invalid pasted XML", async ({ page }) => {
  await page.goto(URL);
  await page.getByLabel(/paste bpmn xml/i).fill("not really xml <<<");
  await page.getByRole("button", { name: /^render$/i }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 15_000 });
});
```

- [ ] **Step 4: 跑 e2e**

Run(背景需要 dev server;`webServer` 會自動啟動或重用):
```bash
pnpm -C /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat-bpmn-viewer --filter web test:e2e
```
Expected: 3 passed。

> 排錯:若 `.djs-element` 選不到,以 `page.locator(".djs-container svg")` 確認 SVG 容器存在後,改用 `[data-element-id]` 選器。確認 locale 前綴(`/en/...`)正確(由 `next-intl` routing 決定)。

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/playwright.config.ts apps/web/e2e/bpmn-viewer.e2e.ts \
  apps/web/.gitignore pnpm-lock.yaml
git commit -m "test(web): add Playwright e2e smoke for bpmn-viewer (render, badge, error)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: 終審驗證(typecheck / lint / test / build / 手動截圖)

**Files:** 無(僅驗證,必要時小幅修正)。

- [ ] **Step 1: 套件 + app 全綠**

Run:
```bash
pnpm -C <worktree> --filter @rfjs/bpmn check-types
pnpm -C <worktree> --filter @rfjs/bpmn lint
pnpm -C <worktree> --filter @rfjs/bpmn vitest:run
pnpm -C <worktree> --filter @rfjs/web-core test
pnpm -C <worktree> --filter web check-types
pnpm -C <worktree> --filter web lint
pnpm -C <worktree> --filter web vitest:run
```
Expected: 全部綠燈。

- [ ] **Step 2: Next build(真正的 SSR 安全驗證)**

Run: `pnpm -C <worktree> --filter web build`
Expected: build 成功 —— 證明 `@rfjs/bpmn`(動態 import bpmn-js)在 SSR/prerender 不崩,`/tools/bpmn-viewer` 進入 `generateStaticParams`。

> 若 build 報 bpmn-js 觸碰 `window`/`document` 的 SSR 錯誤:確認 `bpmn-viewer.tsx` 的 bpmn-js import 仍在 effect 內(動態),CSS import 留在模組頂層;必要時於 `ui.tsx` 以 `next/dynamic(() => import("@rfjs/bpmn").then(m => m.BpmnViewer), { ssr: false })` 載入 `BpmnViewer`,並把 `useBpmnViewer` 仍直接 import(它不碰 DOM)。

- [ ] **Step 3: 手動截圖驗證真渲染(light + dark)**

啟動 dev server,於瀏覽器開 `http://localhost:3000/en/tools/bpmn-viewer`:
```bash
pnpm -C <worktree> --filter web dev
```
確認:預設範例渲染成流程圖、工具列 zoom/fit 有效、切換範例/貼上 XML/上傳 .bpmn 正常、無效 XML 顯示錯誤面板、**右下角 bpmn.io 標誌可見**、深色模式可讀。截圖留存。

- [ ] **Step 4: 確認無殘留 + 不需 changeset**

Run: `git -C <worktree> status`
Expected: 乾淨(所有變更已 commit)。所有觸及套件皆 private,**不建立 changeset**。

- [ ] **Step 5(若有修正才需要): Commit**

```bash
git commit -am "fix(bpmn): address final verification findings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: HOLD —— 不開 PR**

通知使用者全部完成、附手動驗證截圖摘要,等使用者於 GitHub 合併後回報「merged」。

---

## 附錄:Spec ↔ Plan 對應(self-review)

| Spec 需求 | 對應 Task |
| --- | --- |
| 套件 scaffold(private/type:module/exports/scripts/deps) | Task 1 |
| zoom 純函式 | Task 1 |
| `<BpmnViewer>` controlled + ref handle + 生命週期 + 競態保護 + 動態 import(SSR) | Task 2 |
| 型別(Props/Handle/ImportResult/Error) | Task 2 |
| `useBpmnViewer` hook(viewerProps + actions + importing/error) | Task 3 |
| CSS import(diagram-js/bpmn-js/font) | Task 2(Step 4)+ Task 1(鎖路徑) |
| README(en + zh-TW) | Task 4 |
| 範例流程圖(≥2,含 DI) | Task 5 |
| 檔案上傳驗證(副檔名/大小/空) | Task 6 |
| tool UI(工具列/範例/上傳/貼上/錯誤面板/i18n) | Task 7 |
| registry tool 條目 + package catalog 條目 + 聚合器 + EXPECTED ids + transpilePackages | Task 8 |
| 測試:mock 單元 + 純函式 + hook | Task 2/3/5/6/7 |
| 測試:Playwright e2e 真 SVG + badge + 錯誤 | Task 9 |
| 授權:bpmn.io 標誌保留(不隱藏) | Task 2(無隱藏 CSS)+ Task 9(badge 可見斷言)+ Task 10 Step 3 |
| SSR 安全 | Task 2(動態 import)+ Task 10 Step 2(build 驗證) |
| 無 changeset(全 private) | Task 10 Step 4 |
| HOLD PR | Task 10 Step 6 |
