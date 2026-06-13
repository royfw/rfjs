# Workbench 骨架（Phase 1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `apps/workbench`（admin shell 空殼 app）：Next 16 scaffold、i18n、admin shell（sidebar / topbar / ⌘K）、四個路由空殼（dashboard / datasets / apps / admin 預留）、registry `surface` 欄位、共用 `Panel` 元件進 `@rfjs/web-ui`。

**Architecture:** 全面鏡像 `apps/web` 的既有模式（Next 16 App Router + next-intl `[locale]` segment + next-themes + Tailwind v4 經 `@rfjs/web-ui` tokens）。Shell 為自製輕量元件（非整套 shadcn-admin 移植），collapsed 狀態用 zustand。工具/應用本體不在本 Phase（spec §13 Phase 3/4）。

**Tech Stack:** Next 16 / React 19 / next-intl 4 / next-themes / zustand 5 / cmdk / Tailwind v4 / vitest + @testing-library/react

**Spec:** `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md`

**不在本 Phase：** datasets/Dexie、TanStack Table、CodeMirror、PWA、auth 接線、deploy overlay（`.deploy/` Helm 仍 pending，新 app 維持 `[skip-deploy]` 現狀）。

**慣例提醒：** commit 訊息尾端的 Co-Authored-By 依執行者模型名稱（commit-flow skill）。pre-commit hook 會跑 `turbo run lint-staged test --affected`，曾出現 pnpm workspace-state 並行讀寫的瞬態錯誤 — 失敗時先原樣重試一次再調查。

---

### Task 1: registry `surface` 欄位（@rfjs/web-core，TDD）

**Files:**
- Modify: `packages/web-core/src/registry/schemas.ts`
- Modify: `packages/web-core/src/registry/tools.ts`
- Test: `packages/web-core/src/registry/registry.spec.ts`

- [ ] **Step 1: 寫失敗測試** — 在 `registry.spec.ts` 的 `describe('toolRegistry', ...)` 之後新增：

```ts
describe('tool surfaces', () => {
  it('every tool declares a surface', () => {
    for (const tool of toolRegistry) {
      expect(['web', 'workbench'], `${tool.id} missing surface`).toContain(tool.surface);
    }
  });

  it('workbench surface holds exactly the dataset-driven apps', () => {
    const ids = toolRegistry
      .filter((t) => t.surface === 'workbench')
      .map((t) => t.id)
      .sort();
    expect(ids).toEqual(['data-filter-builder', 'object-transformer']);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F @rfjs/web-core vitest:run`
Expected: FAIL — `every tool declares a surface`（`tool.surface` 為 undefined）

- [ ] **Step 3: schema 加欄位** — `schemas.ts` 在 `registryStatusSchema` 之後加：

```ts
export const toolSurfaceSchema = z.enum(['web', 'workbench']);
```

`toolDefinitionSchema` 的 `category` 行後加一行：

```ts
  surface: toolSurfaceSchema,
```

type exports 區加：

```ts
export type ToolSurface = z.infer<typeof toolSurfaceSchema>;
```

- [ ] **Step 4: tools.ts 八個條目補 `surface`** — 在每個條目的 `category` 行後加 `surface`。對照表（spec §2/§9）：

| id | surface |
|---|---|
| object-flatten | `'web'` |
| type-converter | `'web'` |
| data-filter-tester | `'web'` |
| jwt-decoder | `'web'` |
| jsonb-query-generator | `'web'` |
| mongo-query-generator | `'web'` |
| data-filter-builder | `'workbench'` |
| object-transformer | `'workbench'` |

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F @rfjs/web-core vitest:run && pnpm -F @rfjs/web-core check-types && pnpm -F web test`
Expected: 全 PASS（web 的 i18n-content 測試不受影響 — 它檢查 id 對應翻譯，不檢查 surface）

- [ ] **Step 6: Commit**

```bash
git add packages/web-core/src/registry/
git commit -m "feat(web-core): add tool surface field (web | workbench)"
```

---

### Task 2: workbench workspace scaffold

**Files:**
- Create: `apps/workbench/package.json`
- Create: `apps/workbench/tsconfig.json`
- Create: `apps/workbench/next.config.js`
- Create: `apps/workbench/postcss.config.mjs`
- Create: `apps/workbench/eslint.config.js`
- Create: `apps/workbench/vitest.config.mts`
- Create: `apps/workbench/app/globals.css`
- Create: `apps/workbench/app/page.tsx`（暫時頁，Task 3 移除）

- [ ] **Step 1: 確認 workspace 涵蓋 apps/***

Run: `grep apps pnpm-workspace.yaml`
Expected: 出現 `- "apps/*"`（或等價 glob）。若無，停下回報，不要擅自改 workspace 定義。

- [ ] **Step 2: 建 `apps/workbench/package.json`**

```json
{
  "name": "workbench",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "vitest:run": "vitest run"
  },
  "dependencies": {
    "@rfjs/web-core": "workspace:*",
    "@rfjs/web-ui": "workspace:*",
    "cmdk": "^1.1.1",
    "lucide-react": "^1.17.0",
    "next": "^16.2.9",
    "next-intl": "^4.13.0",
    "next-themes": "^0.4.6",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zustand": "^5.0.14"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@next/eslint-plugin-next": "^16.2.9",
    "@tailwindcss/postcss": "^4.3.0",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^25.9.3",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "globals": "^15.14.0",
    "jsdom": "^29.1.1",
    "postcss": "^8.5.15",
    "tailwindcss": "^4.3.0",
    "typescript": "6.0.3",
    "typescript-eslint": "^8.61.0",
    "vitest": "^4.1.8"
  }
}
```

（版本與 `apps/web/package.json` 完全一致 + 新增 `cmdk`。）

- [ ] **Step 3: 複製四個與 web 完全相同的設定檔**

`tsconfig.json`、`postcss.config.mjs`、`eslint.config.js`、`vitest.config.mts` 直接以 `apps/web` 的同名檔為準逐字複製：

```bash
cp apps/web/tsconfig.json apps/web/postcss.config.mjs apps/web/eslint.config.js apps/web/vitest.config.mts apps/workbench/
```

- [ ] **Step 4: 建 `apps/workbench/next.config.js`**

```js
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rfjs/web-ui", "@rfjs/web-core"],
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
```

- [ ] **Step 5: 建 `apps/workbench/app/globals.css`**

```css
@import "@rfjs/web-ui/globals.css";
```

- [ ] **Step 6: 建暫時首頁 `apps/workbench/app/page.tsx`**（驗證 scaffold 可 build；Task 3 會以 `[locale]` 結構取代）

```tsx
export default function Page() {
  return <main>workbench scaffold ok</main>;
}
```

注意：`next.config.js` 引用的 `./i18n/request.ts` 尚不存在會使 build 失敗 — 本 task 先建一個最小檔（Task 3 完整版會覆蓋）：

`apps/workbench/i18n/request.ts`

```ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => ({
  locale: "en",
  messages: {},
}));
```

- [ ] **Step 7: 安裝並驗證 build**

Run: `pnpm install && pnpm -F workbench build`
Expected: install 無錯；`next build` 成功（出現 `Route (app)` 表格含 `/`）

- [ ] **Step 8: Commit**

```bash
git add apps/workbench pnpm-lock.yaml
git commit -m "feat(workbench): scaffold Next 16 app workspace"
```

---

### Task 3: i18n + root layout

**Files:**
- Create: `apps/workbench/i18n/routing.ts`
- Create: `apps/workbench/i18n/navigation.ts`
- Modify: `apps/workbench/i18n/request.ts`（覆蓋 Task 2 的最小版）
- Create: `apps/workbench/middleware.ts`
- Create: `apps/workbench/messages/en.json`
- Create: `apps/workbench/messages/zh-TW.json`
- Create: `apps/workbench/app/[locale]/layout.tsx`
- Create: `apps/workbench/app/[locale]/page.tsx`
- Delete: `apps/workbench/app/page.tsx`（Task 2 暫時頁）

- [ ] **Step 1: 建 `i18n/routing.ts`、`i18n/navigation.ts`，覆蓋 `i18n/request.ts`** — 三檔與 apps/web 同內容：

`i18n/routing.ts`

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh-TW"],
  defaultLocale: "en",
});
```

`i18n/navigation.ts`

```ts
import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

`i18n/request.ts`

```ts
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 2: 建 `middleware.ts`**（與 web 相同）

```ts
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except Next internals, API, and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 3: 建 messages**

`messages/en.json`

```json
{
  "Common": {
    "appName": "rfjs workbench",
    "comingSoon": "Coming soon",
    "github": "GitHub"
  },
  "Nav": {
    "dashboard": "Dashboard",
    "datasets": "Datasets",
    "apps": "Apps",
    "admin": "Admin",
    "adminLocked": "Sign-in required — coming soon",
    "toggleSidebar": "Toggle sidebar"
  },
  "Pages": {
    "dashboardTitle": "Dashboard",
    "dashboardDescription": "Datasets at a glance and shortcuts into the apps.",
    "datasetsTitle": "Datasets",
    "datasetsDescription": "Built-in samples and imported JSON/CSV datasets. Management lands in Phase 3.",
    "appsTitle": "Apps",
    "appsDescription": "Dataset-driven applications composing the @rfjs packages.",
    "adminTitle": "Admin",
    "adminDescription": "Reserved area. Unlocks with demo sign-in in a later phase."
  },
  "CommandMenu": {
    "placeholder": "Type a command or search…",
    "navigation": "Navigation"
  },
  "LocaleSwitcher": {
    "label": "Language"
  }
}
```

`messages/zh-TW.json`

```json
{
  "Common": {
    "appName": "rfjs workbench",
    "comingSoon": "即將推出",
    "github": "GitHub"
  },
  "Nav": {
    "dashboard": "儀表板",
    "datasets": "資料集",
    "apps": "應用",
    "admin": "管理",
    "adminLocked": "需登入 — 即將推出",
    "toggleSidebar": "切換側欄"
  },
  "Pages": {
    "dashboardTitle": "儀表板",
    "dashboardDescription": "資料集總覽與應用捷徑。",
    "datasetsTitle": "資料集",
    "datasetsDescription": "內建範例與匯入的 JSON/CSV 資料集。管理功能於 Phase 3 推出。",
    "appsTitle": "應用",
    "appsDescription": "以 dataset 驅動、組合 @rfjs 套件的應用。",
    "adminTitle": "管理",
    "adminDescription": "保留區域。後續階段以 demo 登入解鎖。"
  },
  "CommandMenu": {
    "placeholder": "輸入指令或搜尋…",
    "navigation": "導覽"
  },
  "LocaleSwitcher": {
    "label": "語言"
  }
}
```

- [ ] **Step 4: 建 `app/[locale]/layout.tsx`**（鏡像 web，標題改 workbench）

```tsx
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { ThemeProvider } from "next-themes";

import { routing } from "@/i18n/routing";
import "../globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "rfjs workbench",
  description: "Dataset-driven workbench composing the @rfjs packages.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${archivo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <NextIntlClientProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: 建 `app/[locale]/page.tsx`（導向 dashboard）並刪除暫時頁**

```tsx
import { redirect } from "@/i18n/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/dashboard", locale });
}
```

```bash
rm apps/workbench/app/page.tsx
```

- [ ] **Step 6: 驗證**

Run: `pnpm -F workbench build`
Expected: build 成功；route 表含 `/[locale]`。（`/dashboard` 此時 404 是預期 — Task 5 建立。）

- [ ] **Step 7: Commit**

```bash
git add apps/workbench
git commit -m "feat(workbench): wire next-intl i18n, theme, and locale layout"
```

---

### Task 4: `Panel` 共用元件（@rfjs/web-ui，TDD）

**Files:**
- Create: `packages/web-ui/src/components/panel.tsx`
- Test: `packages/web-ui/src/components/panel.spec.tsx`

- [ ] **Step 1: 確認 web-ui 內部 import 慣例**

Run: `grep -n "from \"../lib" packages/web-ui/src/components/button.tsx packages/web-ui/src/components/copy-button.tsx | head -3`
Expected: 看到 `cn`（或等價 util）的相對路徑 import。以下程式碼假設 `import { cn } from "../lib/utils"` — 若實際路徑/名稱不同，以實際為準調整。

- [ ] **Step 2: 寫失敗測試** — `panel.spec.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "./panel";

describe("Panel", () => {
  it("renders the title and children", () => {
    render(<Panel title="Datasets">3 samples</Panel>);
    expect(screen.getByRole("heading", { name: "Datasets" })).toBeDefined();
    expect(screen.getByText("3 samples")).toBeDefined();
  });

  it("omits the heading when no title is given", () => {
    render(<Panel>body only</Panel>);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm -F @rfjs/web-ui vitest:run`
Expected: FAIL — Cannot find module './panel'

- [ ] **Step 4: 實作 `panel.tsx`**

```tsx
import * as React from "react";

import { cn } from "../lib/utils";

export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>
      {title ? (
        <h2 className="border-b px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
```

（web-ui 的 `exports` 已是 `./components/*` 萬用字元，新元件自動可由 `@rfjs/web-ui/components/panel` 引用，無需改 package.json。）

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm -F @rfjs/web-ui vitest:run && pnpm -F @rfjs/web-ui check-types`
Expected: 全 PASS

- [ ] **Step 6: Commit**

```bash
git add packages/web-ui/src/components/panel.tsx packages/web-ui/src/components/panel.spec.tsx
git commit -m "feat(web-ui): add Panel section primitive"
```

---

### Task 5: admin shell（sidebar / topbar）+ 四個路由空殼

**Files:**
- Create: `apps/workbench/stores/sidebar-store.ts`
- Test: `apps/workbench/stores/sidebar-store.spec.ts`
- Create: `apps/workbench/components/shell/shell-sidebar.tsx`
- Create: `apps/workbench/components/shell/shell-topbar.tsx`
- Create: `apps/workbench/components/shell/locale-switcher.tsx`
- Create: `apps/workbench/app/[locale]/(shell)/layout.tsx`
- Create: `apps/workbench/app/[locale]/(shell)/dashboard/page.tsx`
- Create: `apps/workbench/app/[locale]/(shell)/datasets/page.tsx`
- Create: `apps/workbench/app/[locale]/(shell)/apps/page.tsx`
- Create: `apps/workbench/app/[locale]/(shell)/apps/[slug]/page.tsx`
- Create: `apps/workbench/app/[locale]/(shell)/admin/page.tsx`

- [ ] **Step 1: 寫 sidebar store 失敗測試** — `stores/sidebar-store.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { useSidebarStore } from "./sidebar-store";

describe("sidebar store", () => {
  it("starts expanded and toggles", () => {
    expect(useSidebarStore.getState().collapsed).toBe(false);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(true);
    useSidebarStore.getState().toggle();
    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
```

Run: `pnpm -F workbench vitest:run` → Expected: FAIL — Cannot find module

- [ ] **Step 2: 實作 `stores/sidebar-store.ts`，確認測試通過**

```ts
import { create } from "zustand";

interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}));
```

Run: `pnpm -F workbench vitest:run` → Expected: PASS

- [ ] **Step 3: 建 `components/shell/locale-switcher.tsx`**

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("LocaleSwitcher");
  return (
    <select
      aria-label={t("label")}
      value={locale}
      onChange={(e) =>
        router.replace(pathname, { locale: e.target.value as (typeof routing.locales)[number] })
      }
      className="rounded-sm border bg-transparent px-2 py-1 text-sm"
    >
      {routing.locales.map((l) => (
        <option key={l} value={l}>
          {l}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 4: 建 `components/shell/shell-sidebar.tsx`**

```tsx
"use client";

import { Boxes, Database, LayoutDashboard, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { useSidebarStore } from "@/stores/sidebar-store";

const NAV = [
  { key: "dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { key: "datasets", href: "/datasets", Icon: Database },
  { key: "apps", href: "/apps", Icon: Boxes },
] as const;

export function ShellSidebar() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <aside
      className={`flex shrink-0 flex-col gap-1 border-r p-3 transition-[width] ${collapsed ? "w-14" : "w-56"}`}
    >
      <span className="mb-3 px-2 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        {collapsed ? "rf" : tCommon("appName")}
      </span>
      {NAV.map(({ key, href, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            title={t(key)}
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent aria-[current=page]:text-signal"
          >
            <Icon className="size-4 shrink-0" />
            {collapsed ? null : t(key)}
          </Link>
        );
      })}
      <span
        title={t("adminLocked")}
        className="flex cursor-not-allowed items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground/60"
      >
        <Lock className="size-4 shrink-0" />
        {collapsed ? null : t("admin")}
      </span>
    </aside>
  );
}
```

（`text-signal` 為 web-ui token，與 web sidebar 的 active 樣式一致。admin 項以鎖示意 — v2 才開放，spec §5。）

- [ ] **Step 5: 建 `components/shell/shell-topbar.tsx`**

```tsx
"use client";

import { PanelLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@rfjs/web-ui/components/theme-toggle";

import { useSidebarStore } from "@/stores/sidebar-store";

import { LocaleSwitcher } from "./locale-switcher";

export function ShellTopbar() {
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <header className="flex items-center gap-3 border-b px-4 py-2">
      <button
        type="button"
        aria-label={t("toggleSidebar")}
        onClick={toggle}
        className="rounded-sm p-1.5 transition-colors hover:bg-accent"
      >
        <PanelLeft className="size-4" />
      </button>
      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <a
          href="https://github.com/royfw/rfjs"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("github")}
        </a>
      </div>
    </header>
  );
}
```

注意：先確認 `ThemeToggle` 的實際 export 名稱與 props：`grep -n "export" packages/web-ui/src/components/theme-toggle.tsx` — 若名稱不同，以實際為準。

- [ ] **Step 6: 建 `(shell)/layout.tsx`**

```tsx
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellTopbar } from "@/components/shell/shell-topbar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ShellSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: 建四個空殼頁**

`dashboard/page.tsx`

```tsx
import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tCommon = await getTranslations("Common");
  const apps = toolRegistry.filter((tool) => tool.surface === "workbench");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("dashboardTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("dashboardDescription")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title={t("datasetsTitle")}>{tCommon("comingSoon")}</Panel>
        <Panel title={t("appsTitle")}>{apps.length}</Panel>
        <Panel title="@rfjs/*">{packageRegistry.length}</Panel>
      </div>
    </div>
  );
}
```

`datasets/page.tsx`

```tsx
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DatasetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tCommon = await getTranslations("Common");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("datasetsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("datasetsDescription")}</p>
      <Panel>{tCommon("comingSoon")}</Panel>
    </div>
  );
}
```

`apps/page.tsx`

```tsx
import { toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function AppsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const apps = toolRegistry.filter((tool) => tool.surface === "workbench");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("appsTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("appsDescription")}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <Link key={app.id} href={`/apps/${app.id}`}>
            <Panel title={app.id}>{app.tags?.join(" · ")}</Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

`apps/[slug]/page.tsx`

```tsx
import { toolRegistry } from "@rfjs/web-core";
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return toolRegistry
    .filter((tool) => tool.surface === "workbench")
    .map((tool) => ({ slug: tool.id }));
}

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const app = toolRegistry.find((tool) => tool.surface === "workbench" && tool.id === slug);
  if (!app) notFound();
  const tCommon = await getTranslations("Common");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-xl">{app.id}</h1>
      <Panel>{tCommon("comingSoon")}</Panel>
    </div>
  );
}
```

`admin/page.tsx`

```tsx
import { Panel } from "@rfjs/web-ui/components/panel";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Pages");
  const tNav = await getTranslations("Nav");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("adminTitle")}</h1>
      <Panel>{tNav("adminLocked")}</Panel>
    </div>
  );
}
```

- [ ] **Step 8: 驗證**

Run: `pnpm -F workbench check-types && pnpm -F workbench lint && pnpm -F workbench build`
Expected: 全部通過；route 表含 `/[locale]/dashboard`、`/[locale]/datasets`、`/[locale]/apps`、`/[locale]/apps/[slug]`、`/[locale]/admin`

Run: `pnpm -F workbench dev` → 手動開 `http://localhost:3001/en`
Expected: 導向 `/en/dashboard`；sidebar 可收合；切 zh-TW 文案改變；admin 項呈鎖定樣式

- [ ] **Step 9: Commit**

```bash
git add apps/workbench
git commit -m "feat(workbench): admin shell with sidebar, topbar, and route shells"
```

---

### Task 6: ⌘K command palette

**Files:**
- Create: `apps/workbench/components/shell/command-menu.tsx`
- Modify: `apps/workbench/app/[locale]/(shell)/layout.tsx`

- [ ] **Step 1: 建 `components/shell/command-menu.tsx`**

```tsx
"use client";

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";

const NAV_KEYS = ["dashboard", "datasets", "apps"] as const;

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("CommandMenu");
  const tNav = useTranslations("Nav");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label={t("placeholder")}
      className="fixed left-1/2 top-1/4 w-full max-w-md -translate-x-1/2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
      overlayClassName="fixed inset-0 bg-black/50"
    >
      <Command.Input
        placeholder={t("placeholder")}
        className="w-full border-b bg-transparent px-2 py-2 text-sm outline-none"
      />
      <Command.List className="max-h-60 overflow-auto pt-2">
        <Command.Group
          heading={t("navigation")}
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground"
        >
          {NAV_KEYS.map((key) => (
            <Command.Item
              key={key}
              onSelect={() => {
                router.push(`/${key}`);
                setOpen(false);
              }}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent"
            >
              {tNav(key)}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

- [ ] **Step 2: 掛進 shell layout** — `(shell)/layout.tsx` 加 import 與元件：

```tsx
import { CommandMenu } from "@/components/shell/command-menu";
import { ShellSidebar } from "@/components/shell/shell-sidebar";
import { ShellTopbar } from "@/components/shell/shell-topbar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ShellSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ShellTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <CommandMenu />
    </div>
  );
}
```

- [ ] **Step 3: 驗證**

Run: `pnpm -F workbench check-types && pnpm -F workbench build`，再 `pnpm -F workbench dev` 手動按 ⌘K / Ctrl+K
Expected: palette 開合正常，選 Datasets 導頁並關閉

- [ ] **Step 4: Commit**

```bash
git add apps/workbench
git commit -m "feat(workbench): add cmd-k command palette"
```

---

### Task 7: README + 全面驗證

**Files:**
- Create: `apps/workbench/README.md`

- [ ] **Step 1: 建 `README.md`**

```markdown
# workbench — rfjs application platform

Admin-style workbench for dataset-driven applications composing the
`@rfjs/*` packages. Quick single-purpose tools live on apps/web; this
app hosts the stateful, dataset-first experiences.

Spec: `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md`

## Develop

```bash
pnpm -F workbench dev          # http://localhost:3001
pnpm -F workbench build
pnpm -F workbench lint
pnpm -F workbench check-types
pnpm -F workbench test
```

## Routes

| Route | State |
|-------|-------|
| `/` | Redirects to `/dashboard` |
| `/dashboard` | Shell placeholder (Phase 1) |
| `/datasets` | Shell placeholder — Dexie-backed management lands in Phase 3 |
| `/apps`, `/apps/[slug]` | Registry-driven index (surface=workbench); apps land in Phase 3 |
| `/admin` | Reserved — unlocks with demo auth (Phase 6) |

## Internationalization

Same pattern as apps/web: next-intl, `[locale]` segment, `en` + `zh-TW`
messages in `messages/`.
```

- [ ] **Step 2: 全 monorepo 驗證**

Run: `pnpm -F @rfjs/web-core test && pnpm -F @rfjs/web-ui test && pnpm -F web test && pnpm -F web build && pnpm -F workbench test && pnpm -F workbench build`
Expected: 全 PASS（特別確認 apps/web 未被 registry 變更破壞）

- [ ] **Step 3: Commit**

```bash
git add apps/workbench/README.md
git commit -m "docs(workbench): add app README"
```

---

## Self-Review 紀錄

- Spec 覆蓋：§13 Phase 1 五項 — scaffold（Task 2）、shell（Task 5/6）、i18n+主題（Task 3）、四路由空殼（Task 5）、registry surface（Task 1）、web-ui 版型基礎元件（Task 4）✓
- 型別一致：`useSidebarStore`（Task 5 Step 1/2 與 sidebar/topbar 引用）、`Panel` props（Task 4 定義與 Task 5 使用）、`toolSurfaceSchema`（Task 1 定義與 Task 5 `surface === "workbench"` 篩選）✓
- 外部不確定點已設防：`pnpm-workspace.yaml` glob（Task 2 Step 1）、web-ui `cn` import 路徑（Task 4 Step 1）、`ThemeToggle` export 名（Task 5 Step 5 注記）— 皆為「先驗證再依實際調整」步驟，非盲信
