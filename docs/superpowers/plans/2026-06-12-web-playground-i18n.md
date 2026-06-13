# rfjs Web Playground — i18n (zh-TW + en) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The next-intl App Router structure (root vs `[locale]` layout, middleware matcher) changes across versions — Task 2 must verify the exact arrangement against current next-intl docs via context7 before finalizing.

**Goal:** Make `apps/web` bilingual (English + Traditional Chinese) with next-intl: `[locale]` routing, message catalogs, a header locale switcher, and the registry refactored so structure (language-neutral) and display copy (translatable) are separated — done now while the surface is tiny, before Phase 3 multiplies pages.

**Architecture:** next-intl drives locale routing (`/en/...`, `/zh-TW/...`) via middleware + a `[locale]` segment. `@rfjs/web-core` registries become **structure-only** (ids, hrefs, status, relations); all human-readable titles/descriptions live in `apps/web/messages/{en,zh-TW}.json`. UI chrome strings move to the same catalogs. Server Components read messages via `getTranslations`; client components via `useTranslations`. next-themes + Tailwind + The Seam tokens are untouched — locale and theme are independent.

**Tech Stack:** next-intl v4 · Next.js 16 App Router · React 19 · TypeScript 6 · (existing) Tailwind v4 / shadcn / next-themes / Zustand.

---

## Decisions locked for this plan

- **Locales:** `en` (default) + `zh-TW`. `defaultLocale: 'en'` because the content base is English (package names, code, JSON); switching the default to `zh-TW` later is a one-line change in `routing.ts`.
- **localePrefix:** `'always'` (every route prefixed; `/` redirects to `/en`). Simplest and unambiguous; can move to `'as-needed'` later without touching components.
- **Registry split (the key design choice):** `@rfjs/web-core` registries drop `title`/`description` and keep only language-neutral structure. All display copy lives in the app's message catalogs keyed by tool `id` / package slug. This keeps web-core as the single source of *structure* and makes every visible string translatable — clean now (8 tools, 10 packages), painful after Phase 3.
- **Realistic scope:** UI chrome + intro copy + tool/package titles & descriptions are translated. Technical tokens (package names like `@rfjs/object-utils`, code snippets, JSONPath) stay verbatim — they are not translated.
- **Folded-in follow-ups:** the font-token self-reference tech debt (Task 2) and the mobile-nav a11y gaps (Task 3) are fixed where i18n already touches those files; CopyButton hardening rides along in Task 1.

**Commit convention:** conventional commits (commitlint-enforced); every message ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never `--no-verify`. App/private-package code — no changeset. Run all commands from the worktree root `/home/royfw/_/royfw/_apps/rfjs/.claude/worktrees/feat+web-playground`.

---

## File structure

```
apps/web/
  i18n/routing.ts                      # NEW: defineRouting (locales, defaultLocale)
  i18n/navigation.ts                   # NEW: createNavigation wrappers (Link, useRouter, usePathname)
  i18n/request.ts                      # NEW: getRequestConfig (load messages per locale)
  middleware.ts                        # NEW: createMiddleware(routing) + matcher
  next.config.js                       # MODIFY: wrap with createNextIntlPlugin
  messages/en.json                     # NEW: English catalog (source)
  messages/zh-TW.json                  # NEW: Traditional Chinese catalog
  app/layout.tsx                       # MODIFY/REMOVE per next-intl docs (root vs locale layout)
  app/[locale]/layout.tsx              # NEW: <html lang>, fonts (fixed var names), ThemeProvider, NextIntlClientProvider, setRequestLocale
  app/[locale]/(site)/**               # MOVED from app/(site)/**
  components/layout/locale-switcher.tsx# NEW: header language switcher (client)
  components/layout/mobile-nav.tsx     # MODIFY: translate labels + a11y (focus trap, Esc, role=dialog)
  components/layout/app-header.tsx     # MODIFY: translated aria-labels + LocaleSwitcher
  components/layout/app-sidebar.tsx    # MODIFY: translated package group labels + tool titles
  components/shared/tool-card.tsx      # MODIFY: title/desc from messages, not registry
  components/shared/package-card.tsx   # MODIFY: description from messages
  components/home/* , app/[locale]/(site)/**/page.tsx  # MODIFY: copy via translations
  lib/i18n-content.ts                  # NEW: helpers to resolve tool/package message keys
packages/web-ui/src/components/copy-button.tsx  # MODIFY: try/catch + timer cleanup (Task 1)
packages/web-core/src/registry/schemas.ts       # MODIFY: drop title/description
packages/web-core/src/registry/tools.ts         # MODIFY: drop title/description
packages/web-core/src/registry/packages.ts      # MODIFY: drop description
packages/web-core/src/registry/registry.spec.ts # MODIFY: drop title/description assertions
```

---

### Task 1: Harden CopyButton (isolated pre-work)

**Files:**
- Modify: `packages/web-ui/src/components/copy-button.tsx`

The Phase 2 review flagged `clipboard.writeText` with no error handling and a `setTimeout` not cleared on unmount. Fix both before i18n touches anything.

- [ ] **Step 1: Replace the component body** — `packages/web-ui/src/components/copy-button.tsx`

```tsx
"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "./button";

export interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context / unsupported) — leave label unchanged.
    }
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={onCopy} aria-live="polite">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types && pnpm -F @rfjs/web-ui vitest:run`
Expected: all exit 0; the existing 6 component tests still pass.

- [ ] **Step 3: Commit**

```bash
git add packages/web-ui/src/components/copy-button.tsx
git commit -m "fix(web-ui): guard CopyButton clipboard call and clear timer on unmount

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: next-intl plumbing + `[locale]` restructure + locale layout (font-var fix folded)

**Files:**
- Create: `apps/web/i18n/routing.ts`, `apps/web/i18n/navigation.ts`, `apps/web/i18n/request.ts`, `apps/web/middleware.ts`, `apps/web/messages/en.json`, `apps/web/messages/zh-TW.json`, `apps/web/app/[locale]/layout.tsx`
- Modify: `apps/web/next.config.js`, `packages/web-ui/src/styles/globals.css`
- Move: `apps/web/app/(site)/**` → `apps/web/app/[locale]/(site)/**`; remove old `apps/web/app/layout.tsx`

This is one coherent commit (restructuring routing leaves no green intermediate). **Before writing layout files, consult next-intl's current "App Router setup (with i18n routing)" docs via context7** to confirm the exact root-layout vs `[locale]`-layout arrangement for Next.js 16 (this detail has changed across next-intl versions). The code below is the v4 pattern; adapt only the root-layout handling if the docs differ, and verify with `next build`.

- [ ] **Step 1: Install next-intl**

```bash
pnpm view next-intl dist-tags.latest   # confirm v4.x
pnpm -F web add next-intl
```

- [ ] **Step 2: Routing config** — `apps/web/i18n/routing.ts`

```ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "zh-TW"],
  defaultLocale: "en",
});
```

- [ ] **Step 3: Navigation wrappers** — `apps/web/i18n/navigation.ts`

```ts
import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

- [ ] **Step 4: Request config** — `apps/web/i18n/request.ts`

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

- [ ] **Step 5: Middleware** — `apps/web/middleware.ts`

```ts
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all paths except Next internals, API, and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

- [ ] **Step 6: Wrap next.config with the plugin** — `apps/web/next.config.js`

```js
import createNextIntlPlugin from "next-intl/plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rfjs/web-ui", "@rfjs/web-core"],
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
```

- [ ] **Step 7: Seed minimal message catalogs** (full copy lands in Tasks 3–4) — `apps/web/messages/en.json`

```json
{
  "Home": { "title": "rfjs" }
}
```

`apps/web/messages/zh-TW.json`:

```json
{
  "Home": { "title": "rfjs" }
}
```

- [ ] **Step 8: Move the route group under `[locale]`**

```bash
mkdir -p "apps/web/app/[locale]"
git mv "apps/web/app/(site)" "apps/web/app/[locale]/(site)"
git rm apps/web/app/layout.tsx
```

- [ ] **Step 9: Create the locale layout (fonts with FIXED variable names + providers)** — `apps/web/app/[locale]/layout.tsx`

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
  title: "rfjs — RoyFW's TypeScript utility toolkit",
  description:
    "Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query workflows.",
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
      <body
        className={`${archivo.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
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

- [ ] **Step 10: Fix the font-token self-reference** — in `packages/web-ui/src/styles/globals.css`, change the two self-referential `@theme inline` lines to point at the distinct next/font variables:

```css
  --font-sans: var(--font-archivo, ui-sans-serif, system-ui, sans-serif);
  --font-mono: var(--font-jetbrains-mono, ui-monospace, "SF Mono", Menlo, monospace);
```

- [ ] **Step 11: Verify build, routing, and root-layout requirement**

```bash
pnpm -F web build
```

Expected: exit 0; route list shows `/[locale]` routes (`/en`, `/en/packages`, …, `/zh-TW`, …). If Next.js 16 errors that a root layout is required, add the documented next-intl root passthrough (`apps/web/app/layout.tsx` returning `children` and a `app/[locale]/not-found.tsx`) exactly as the next-intl docs specify, then rebuild. Then smoke-check with `pnpm -F web dev`: `/` redirects to `/en`; `/en` and `/zh-TW` both render; theme toggle still works.

- [ ] **Step 12: Lint + types + commit**

```bash
pnpm -F web lint && pnpm -F web check-types && pnpm -F @rfjs/web-ui check-types
git add apps/web packages/web-ui/src/styles/globals.css
git commit -m "feat(web): add next-intl [locale] routing and locale layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Translate UI chrome + fix mobile-nav a11y

**Files:**
- Modify: `apps/web/app/[locale]/(site)/page.tsx`, `apps/web/components/home/hero-specimen.tsx`, `apps/web/components/layout/app-header.tsx`, `apps/web/components/layout/mobile-nav.tsx`, `apps/web/app/[locale]/(site)/{packages,tools,playground,templates}/page.tsx`
- Modify: `apps/web/messages/en.json`, `apps/web/messages/zh-TW.json`

Translate app-owned chrome strings (nav labels, page headers, homepage copy, button labels). Registry-derived strings (tool titles, package descriptions) are Task 4.

- [ ] **Step 1: Add chrome namespaces to both catalogs**

`apps/web/messages/en.json` (merge into existing):

```json
{
  "Common": { "openMenu": "Open menu", "closeMenu": "Close menu", "github": "GitHub repository" },
  "Home": {
    "title": "rfjs",
    "eyebrowLeft": "left",
    "becomes": "becomes",
    "eyebrowRight": "right",
    "tagline": "Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query workflows. Data in one shape, out another — that transformation is the whole site.",
    "viewPackages": "View Packages",
    "browseTools": "Browse Tools",
    "startHere": "Start here",
    "packagesHeading": "Packages",
    "packagesSubtitle": "The @rfjs/* toolkit — each one a single data gesture.",
    "viewAll": "view all →"
  },
  "Features": {
    "showcaseTitle": "Package Showcase",
    "showcaseBody": "Every tool is a live demo of an @rfjs/* package.",
    "toolsTitle": "Data Tools",
    "toolsBody": "Flatten, convert, decode — all in your browser.",
    "playgroundTitle": "Query & Filter Playground",
    "playgroundBody": "Build filters, compile them to SQL or Mongo.",
    "templatesTitle": "Templates",
    "templatesBody": "Scaffold TypeScript projects with start-ts-by."
  },
  "Pages": {
    "packagesTitle": "Packages",
    "packagesDescription": "The @rfjs/* utility toolkit.",
    "toolsTitle": "Tools",
    "toolsDescription": "Developer data tools, each powered by an @rfjs/* package.",
    "playgroundTitle": "Playground",
    "playgroundDescription": "Interactive builders for @rfjs/* workflows.",
    "templatesTitle": "Templates",
    "templatesDescription": "start-ts-by project templates.",
    "templatesBody": "Template gallery (sourced from templates/registry.json) arrives in a later phase."
  },
  "LocaleSwitcher": { "label": "Language", "en": "English", "zh-TW": "繁體中文" }
}
```

`apps/web/messages/zh-TW.json` (same keys, translated):

```json
{
  "Common": { "openMenu": "開啟選單", "closeMenu": "關閉選單", "github": "GitHub 儲存庫" },
  "Home": {
    "title": "rfjs",
    "eyebrowLeft": "左",
    "becomes": "化為",
    "eyebrowRight": "右",
    "tagline": "處理 JSON、物件、篩選與查詢工作流的工具、playground 與開發者資料工具。資料進來一種形狀、出去另一種 —— 這個轉換就是整個網站。",
    "viewPackages": "瀏覽套件",
    "browseTools": "瀏覽工具",
    "startHere": "從這裡開始",
    "packagesHeading": "套件",
    "packagesSubtitle": "@rfjs/* 工具組 —— 每個都是一個資料動作。",
    "viewAll": "查看全部 →"
  },
  "Features": {
    "showcaseTitle": "套件展示",
    "showcaseBody": "每個工具都是某個 @rfjs/* 套件的即時示範。",
    "toolsTitle": "資料工具",
    "toolsBody": "壓平、轉型、解碼 —— 全在瀏覽器完成。",
    "playgroundTitle": "查詢與篩選 Playground",
    "playgroundBody": "組合篩選條件,編譯成 SQL 或 Mongo 查詢。",
    "templatesTitle": "範本",
    "templatesBody": "用 start-ts-by 建立 TypeScript 專案。"
  },
  "Pages": {
    "packagesTitle": "套件",
    "packagesDescription": "@rfjs/* 工具組。",
    "toolsTitle": "工具",
    "toolsDescription": "開發者資料工具,每個都由某個 @rfjs/* 套件驅動。",
    "playgroundTitle": "Playground",
    "playgroundDescription": "@rfjs/* 工作流的互動式建構器。",
    "templatesTitle": "範本",
    "templatesDescription": "start-ts-by 專案範本。",
    "templatesBody": "範本藝廊(資料源自 templates/registry.json)會在後續階段推出。"
  },
  "LocaleSwitcher": { "label": "語言", "en": "English", "zh-TW": "繁體中文" }
}
```

- [ ] **Step 2: Translate the homepage** — in `apps/web/app/[locale]/(site)/page.tsx`, replace hardcoded copy with `getTranslations`. Add at the top of the component:

```tsx
import { getTranslations } from "next-intl/server";
```

Make the component async and derive strings:

```tsx
export default async function HomePage() {
  const t = await getTranslations("Home");
  const tf = await getTranslations("Features");
  const featuredPackages = packageRegistry.filter((p) => p.status === "ready").slice(0, 6);
  const features = [
    { title: tf("showcaseTitle"), body: tf("showcaseBody"), href: "/packages" },
    { title: tf("toolsTitle"), body: tf("toolsBody"), href: "/tools" },
    { title: tf("playgroundTitle"), body: tf("playgroundBody"), href: "/playground" },
    { title: tf("templatesTitle"), body: tf("templatesBody"), href: "/templates" },
  ];
  // ...render: replace the eyebrow text with t("eyebrowLeft")/t("becomes")/t("eyebrowRight"),
  // the tagline with t("tagline"), button labels with t("viewPackages")/t("browseTools"),
  // "Start here" with t("startHere"), the Packages heading/subtitle/"view all" with
  // t("packagesHeading")/t("packagesSubtitle")/t("viewAll").
}
```

Replace each literal string in the JSX with the corresponding `t(...)`/`tf(...)` call. Internal links must use the i18n `Link`:

```tsx
import { Link } from "@/i18n/navigation";
```

(remove the `next/link` import).

- [ ] **Step 3: Translate the four listing/placeholder pages** — in each of `packages/page.tsx`, `tools/page.tsx`, `playground/page.tsx`, `templates/page.tsx`, replace the `PageHeader` literal `title`/`description` with `getTranslations("Pages")` values, e.g. for `packages/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function PackagesPage() {
  const t = await getTranslations("Pages");
  return (
    <>
      <PageHeader title={t("packagesTitle")} description={t("packagesDescription")} />
      {/* grid unchanged */}
    </>
  );
}
```

Apply the analogous change to `tools` (`toolsTitle`/`toolsDescription`), `playground` (`playgroundTitle`/`playgroundDescription`), and `templates` (`templatesTitle`/`templatesDescription` + replace the body `<p>` with `t("templatesBody")`). Remove the `export const metadata` literals or convert them to `generateMetadata` using the same keys.

- [ ] **Step 4: Translate the header + fix the GitHub aria-label** — `apps/web/components/layout/app-header.tsx`: make it use translations. Since `AppHeader` is a server component, fetch with `getTranslations`:

```tsx
import { getTranslations } from "next-intl/server";
```

```tsx
export async function AppHeader() {
  const t = await getTranslations("Common");
  // ...replace aria-label="GitHub repository" with aria-label={t("github")}
  // and the wordmark Link uses the i18n Link import.
}
```

- [ ] **Step 5: Rewrite `mobile-nav.tsx` with translated labels + a11y** — `apps/web/components/layout/mobile-nav.tsx`

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useState } from "react";

import { AppSidebar } from "./app-sidebar";

export function MobileNav() {
  const t = useTranslations("Common");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button
        ref={openerRef}
        variant="ghost"
        size="icon"
        aria-label={t("openMenu")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            aria-label={t("closeMenu")}
            className="absolute inset-0 bg-bedrock/70"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("openMenu")}
            className="relative z-10 h-full w-72 max-w-[80%] overflow-y-auto border-r border-border bg-slab outline-none"
          >
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" aria-label={t("closeMenu")} onClick={() => setOpen(false)}>
                <X className="size-5" />
              </Button>
            </div>
            <div onClick={() => setOpen(false)}>
              <AppSidebar />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

Note: the backdrop and the X button now have distinct accessible names (`closeMenu` on both is acceptable since they do the same thing; the panel itself is the labelled `dialog`). The Phase 2 review's duplicate-aria-label concern is resolved by the panel being the dialog landmark and the buttons being actions within it.

- [ ] **Step 6: Verify**

Run: `pnpm -F web lint && pnpm -F web check-types && pnpm -F web build`
Then `pnpm -F web dev`: `/en` shows English chrome, `/zh-TW` shows Chinese chrome; mobile drawer (≤`lg`) opens, traps focus, closes on Escape and returns focus to the opener.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): translate UI chrome and harden mobile-nav a11y

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Split registry structure from content (TDD)

**Files:**
- Modify: `packages/web-core/src/registry/schemas.ts`, `tools.ts`, `packages.ts`, `registry.spec.ts`
- Create: `apps/web/lib/i18n-content.ts`, `apps/web/lib/i18n-content.spec.ts`
- Modify: `apps/web/messages/en.json`, `apps/web/messages/zh-TW.json`, `apps/web/components/shared/tool-card.tsx`, `package-card.tsx`, `apps/web/components/layout/app-sidebar.tsx`, `apps/web/app/[locale]/(site)/{tools,packages}/[slug]/page.tsx`

`@rfjs/web-core` becomes structure-only; titles/descriptions move to catalogs keyed by tool `id` and package slug (`@rfjs/object-utils` → `object-utils`).

- [ ] **Step 1: Drop display copy from the schemas** — `packages/web-core/src/registry/schemas.ts`: remove `title` and `description` from `toolDefinitionSchema`, and `description` from `packageDefinitionSchema`. Resulting tool schema keeps `id, category, href, status, relatedPackages?, tags?`; package schema keeps `name, status, href, npm?, github?, tags?, relatedTools?`.

- [ ] **Step 2: Update the registry data** — in `tools.ts` and `packages.ts`, delete every `title:` / `description:` line. (Keep all other fields untouched.)

- [ ] **Step 3: Fix the web-core tests** — `registry.spec.ts`: remove the assertions that referenced `title`/`description` (the schema-parse, uniqueness, and cross-ref tests stay; they no longer touch the removed fields).

- [ ] **Step 4: Verify web-core still green**

Run: `pnpm -F @rfjs/web-core lint && pnpm -F @rfjs/web-core check-types && pnpm -F @rfjs/web-core vitest:run`
Expected: exit 0; tests pass against the trimmed schema.

- [ ] **Step 5: Add tool/package copy to both catalogs** — append to `apps/web/messages/en.json`:

```json
{
  "Tools": {
    "object-flatten": { "title": "Object Flatten / Unflatten", "description": "Flatten nested objects to dot-path keys and back." },
    "type-converter": { "title": "Data Type Converter", "description": "Convert values between string, number, boolean, and date." },
    "data-filter-tester": { "title": "JSONPath Filter Tester", "description": "Run @rfjs/data-filter conditions against sample data live." },
    "jwt-decoder": { "title": "JWT Decoder", "description": "Decode JWT header and payload locally — nothing leaves your browser." },
    "jsonb-query-generator": { "title": "Filter → JSONB SQL", "description": "Generate PostgreSQL JSONB queries from filter metadata." },
    "mongo-query-generator": { "title": "Filter → Mongo Query", "description": "Generate MongoDB queries from filter metadata." },
    "data-filter-builder": { "title": "Data Filter Builder", "description": "Compose nested filter conditions visually and export them." },
    "object-transformer": { "title": "Object Transformer", "description": "Interactive object transformation playground." }
  },
  "Packages": {
    "data-filter": { "description": "Filter in-memory data with JSONPath-addressed conditions." },
    "data-transform": { "description": "Data type transformation utilities (string/number/boolean/date)." },
    "data-label": { "description": "Compose display label strings from data paths, value maps, and templates." },
    "jsonb-query": { "description": "PostgreSQL JSONB query builder from filter metadata." },
    "jwt": { "description": "JWT sign/verify/decode helper." },
    "mongo-query": { "description": "MongoDB query builder from filter metadata." },
    "object-utils": { "description": "Object manipulation utilities (flatten, paths, merge)." },
    "pg-toolkit": { "description": "PostgreSQL admin utilities (seed history, DB/schema creation)." },
    "retry": { "description": "Retry helper with configurable delay." },
    "tpl-toolkit": { "description": "Shared config factories for rfjs project templates." }
  }
}
```

Append the Traditional Chinese equivalents to `apps/web/messages/zh-TW.json` under the same `Tools`/`Packages` keys (translate the human sentences; keep `@rfjs/*` names and technical tokens verbatim). Example entries:

```json
{
  "Tools": {
    "object-flatten": { "title": "物件壓平 / 還原", "description": "把巢狀物件壓平成點路徑鍵,並可還原。" },
    "type-converter": { "title": "資料型別轉換器", "description": "在字串、數字、布林、日期之間轉換值。" },
    "data-filter-tester": { "title": "JSONPath 篩選測試器", "description": "對範例資料即時執行 @rfjs/data-filter 條件。" },
    "jwt-decoder": { "title": "JWT 解碼器", "description": "在本機解碼 JWT 標頭與內容 —— 資料不離開瀏覽器。" },
    "jsonb-query-generator": { "title": "篩選 → JSONB SQL", "description": "從篩選 metadata 產生 PostgreSQL JSONB 查詢。" },
    "mongo-query-generator": { "title": "篩選 → Mongo 查詢", "description": "從篩選 metadata 產生 MongoDB 查詢。" },
    "data-filter-builder": { "title": "資料篩選建構器", "description": "視覺化組合巢狀篩選條件並匯出。" },
    "object-transformer": { "title": "物件轉換器", "description": "互動式物件轉換 playground。" }
  },
  "Packages": {
    "data-filter": { "description": "用 JSONPath 條件篩選記憶體內資料。" },
    "data-transform": { "description": "資料型別轉換工具(字串/數字/布林/日期)。" },
    "data-label": { "description": "從資料路徑、值對應與樣板組合顯示用標籤字串。" },
    "jsonb-query": { "description": "從篩選 metadata 建構 PostgreSQL JSONB 查詢。" },
    "jwt": { "description": "JWT 簽署/驗證/解碼工具。" },
    "mongo-query": { "description": "從篩選 metadata 建構 MongoDB 查詢。" },
    "object-utils": { "description": "物件操作工具(壓平、路徑、合併)。" },
    "pg-toolkit": { "description": "PostgreSQL 管理工具(seed 歷史、建立 DB/schema)。" },
    "retry": { "description": "可設定延遲的重試工具。" },
    "tpl-toolkit": { "description": "rfjs 專案範本的共用設定工廠。" }
  }
}
```

- [ ] **Step 6: Write the failing content-helper test** — `apps/web/lib/i18n-content.spec.ts`

```ts
import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { packageSlug } from "./i18n-content";
import en from "../messages/en.json";
import zhTW from "../messages/zh-TW.json";

describe("registry content keys exist in every catalog", () => {
  const catalogs = { en, "zh-TW": zhTW } as Record<string, any>;

  it("every tool id has title + description in both locales", () => {
    for (const [loc, msg] of Object.entries(catalogs)) {
      for (const tool of toolRegistry) {
        expect(msg.Tools?.[tool.id]?.title, `${loc} Tools.${tool.id}.title`).toBeTruthy();
        expect(msg.Tools?.[tool.id]?.description, `${loc} Tools.${tool.id}.description`).toBeTruthy();
      }
    }
  });

  it("every package slug has a description in both locales", () => {
    for (const [loc, msg] of Object.entries(catalogs)) {
      for (const pkg of packageRegistry) {
        const slug = packageSlug(pkg.name);
        expect(msg.Packages?.[slug]?.description, `${loc} Packages.${slug}.description`).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 7: Run it; confirm it fails**

Run: `pnpm -F web vitest:run`
Expected: FAIL — `packageSlug` not found.

- [ ] **Step 8: Implement the helper** — `apps/web/lib/i18n-content.ts`

```ts
export function packageSlug(name: string): string {
  return name.replace(/^@rfjs\//, "");
}
```

- [ ] **Step 9: Run it; confirm it passes**

Run: `pnpm -F web vitest:run`
Expected: PASS (this also asserts catalog completeness for both locales).

- [ ] **Step 10: Migrate the components to read copy from messages**

`tool-card.tsx` (client or server — it has no hooks, keep it a server component and accept translated strings as props or fetch). Simplest: make it a presentational component that takes resolved strings. Change its signature and callers:

```tsx
import type { ToolDefinition } from "@rfjs/web-core";
import { Seam } from "@rfjs/web-ui/components/seam";

import { Link } from "@/i18n/navigation";

export function ToolCard({ tool, title, description }: { tool: ToolDefinition; title: string; description: string }) {
  return (
    <Link href={tool.href} className="group flex flex-col gap-3 rounded-md border border-border bg-slab p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-medium">{title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">{tool.status}</span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="h-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Seam state="current" operation={tool.category} orientation="horizontal" />
      </div>
    </Link>
  );
}
```

`package-card.tsx` analogously takes a `description` prop.

In the tools/playground listing pages and the homepage, resolve the strings via `getTranslations` and pass them down:

```tsx
const tTools = await getTranslations("Tools");
// ...
{toolRegistry.map((tool) => (
  <ToolCard key={tool.id} tool={tool} title={tTools(`${tool.id}.title`)} description={tTools(`${tool.id}.description`)} />
))}
```

For packages listing/homepage:

```tsx
const tPackages = await getTranslations("Packages");
// ...
<PackageCard key={pkg.name} pkg={pkg} description={tPackages(`${packageSlug(pkg.name)}.description`)} />
```

`app-sidebar.tsx` is a client component (`usePathname`); switch it to `useTranslations("Tools")` and render `t(\`${tool.id}.title\`)` instead of `tool.title`.

The `[slug]` detail pages: replace `pkg.description`/`tool.title` with the corresponding `getTranslations` lookups (await params, resolve `packageSlug`/`tool.id`).

- [ ] **Step 11: Verify everything green**

Run: `pnpm -F @rfjs/web-core vitest:run && pnpm -F web vitest:run && pnpm -F web lint && pnpm -F web check-types && pnpm -F web build`
Expected: all exit 0; build prerenders `/en/*` and `/zh-TW/*`.

- [ ] **Step 12: Commit**

```bash
git add packages/web-core apps/web
git commit -m "refactor(web): move registry display copy into i18n catalogs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Header locale switcher

**Files:**
- Create: `apps/web/components/layout/locale-switcher.tsx`
- Modify: `apps/web/components/layout/app-header.tsx`

- [ ] **Step 1: Implement the switcher** — `apps/web/components/layout/locale-switcher.tsx`

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace({ pathname, params }, { locale: next });
    });
  }

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={t("label")}>
      {routing.locales.map((cur) => (
        <Button
          key={cur}
          variant="ghost"
          size="sm"
          disabled={isPending}
          aria-pressed={cur === locale}
          className="font-mono text-[11px] aria-pressed:text-intake"
          onClick={() => switchTo(cur)}
        >
          {cur === "zh-TW" ? "中" : "EN"}
        </Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Mount it in the header** — in `apps/web/components/layout/app-header.tsx`, import and render `<LocaleSwitcher />` immediately before `<ThemeToggle />` in the right-hand control group.

```tsx
import { LocaleSwitcher } from "./locale-switcher";
```

- [ ] **Step 3: Verify**

Run: `pnpm -F web lint && pnpm -F web check-types && pnpm -F web build`
Then `pnpm -F web dev`: toggling 中/EN swaps locale while keeping the current path; theme is unaffected.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout
git commit -m "feat(web): add header locale switcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Monorepo green + docs

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: Full verification**

Run: `pnpm turbo run lint check-types test build`
Expected: all succeed (pre-existing data-filter/orm-app/orm-kysely warnings only; 0 errors). Fix or report any red — never claim green without this output.

- [ ] **Step 2: Document i18n in the app README** — append:

```markdown
## Internationalization

Bilingual via [next-intl](https://next-intl.dev): English (`en`, default) and Traditional Chinese (`zh-TW`).

- Routing: `[locale]` segment (`/en/...`, `/zh-TW/...`); config in `i18n/routing.ts`, middleware in `middleware.ts`.
- Strings: `messages/en.json` + `messages/zh-TW.json`. UI chrome under `Common`/`Home`/`Features`/`Pages`; tool & package copy under `Tools`/`Packages` keyed by tool id / package slug.
- The `@rfjs/web-core` registries hold language-neutral structure only; all display copy is translated. A test (`lib/i18n-content.spec.ts`) fails if any registry entry is missing a string in either locale.
- Switch language via the header switcher; switch theme independently (next-themes).
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): document the i18n setup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** next-intl plumbing + `[locale]` routing ✓(T2), message catalogs ✓(T2–T4), registry structure/content split ✓(T4), locale switcher ✓(T5), zh-TW + en ✓(catalogs). Folded follow-ups: font-token self-reference fixed ✓(T2 Step 10), mobile-nav a11y ✓(T3 Step 5), CopyButton hardening ✓(T1).
- **Placeholder scan:** Task 2's root-layout arrangement is a deliberate "verify against current next-intl docs" step (the one detail that genuinely varies by version), with the v4 code given and a build gate — not a vague TODO. Task 3 Step 2 describes the homepage edits in prose because the full polished JSX already exists in the repo; the exact `t(...)` substitutions and the async/`getTranslations`/i18n-`Link` changes are all spelled out. Everything else ships complete code.
- **Type consistency:** `routing` (locales `en`/`zh-TW`), `packageSlug`, message namespaces (`Common`/`Home`/`Features`/`Pages`/`Tools`/`Packages`/`LocaleSwitcher`), and the new `ToolCard`/`PackageCard` prop shapes (`title`/`description` passed in) are used consistently across tasks. After T4 the registry no longer exposes `title`/`description`, and every consumer (cards, sidebar, listing, detail, homepage) is migrated to `getTranslations`/`useTranslations` in the same task — no dangling `tool.title` references remain.
- **Risk noted:** moving `app/(site)` under `app/[locale]` is the one structurally invasive step; it lands in a single commit (T2) that ends green, and the root-layout requirement is resolved against the build. Doing this now (10 routes, ~20 registry strings) is the cheap moment; after Phase 3 it would touch every tool page.
```
