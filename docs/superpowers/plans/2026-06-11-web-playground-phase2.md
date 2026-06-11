# rfjs Web Playground — Phase 2 (Frame, Skeleton & Polished Homepage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. For the homepage (Task 9), also invoke the `frontend-design:frontend-design` skill — it is the one finished, design-forward page.

**Goal:** Turn the Phase 1 foundation into a navigable, responsive, themed site with one genuinely polished page — "The Seam" design tokens + fonts land, a full AppShell (header + registry-driven sidebar + mobile drawer) wraps every page, all planned routes exist as registry-driven skeletons you can click through at 375px and 1440px, and the **homepage is a finished, polished intro page** that shows "The Seam" alive.

**Architecture:** Design tokens and shared UI (`<Seam>`, `<CopyButton>`, theme toggle) live in `@rfjs/web-ui`; app-specific layout (AppShell, nav, route pages) lives in `apps/web`. Pages are static (App Router, no `output: 'export'`). The sidebar and all listing pages are driven by the `@rfjs/web-core` registries — one source of truth, so later phases only fill content into shells that already exist.

**Tech Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 6 strict · Tailwind CSS v4 · shadcn/ui · next-themes · Zustand · lucide-react.

---

## Decisions locked for this phase (from design sign-off + discussion)

- **Breadth-first + one polished page**: build the whole navigable skeleton now AND a finished, polished homepage intro page (the page that shows "The Seam" alive). Listing pages (`/packages`, `/tools`, `/playground`) render real registry data; package/tool **detail** pages stay framed placeholders.
- **Per-package tool pages deferred**: how each `@rfjs/*` package is brought into the web as a working tool/detail page is decided **per package, in later individual discussions** — not in this phase. So there is no tool engine, no interactive object-flatten, no `nuqs`, no CodeMirror here. The homepage's transformation specimen is **static, hand-authored display content** (it does not import or run a package), keeping this phase free of package-integration decisions.
- **Theme**: `next-themes` (class-based `.dark`/`.light`, SSR-safe, no FOUC). Zustand holds only non-theme cross-page UI state (sidebar collapse). This supersedes the original prompt's "theme in Zustand".
- **Design source of truth**: `docs/superpowers/specs/2026-06-11-web-design-plan.md` ("The Seam"). Tokens/fonts/Seam behavior come from there verbatim.

**Commit convention:** conventional commits (commitlint-enforced); every message ends with the footer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never `--no-verify`. New packages/app code here is private — no changeset. Run all commands from the worktree root `/home/royfw/_/royfw/_apps/rfjs/.claude/worktrees/feat+web-playground`.

---

## File structure (created/modified in this phase)

```
packages/web-ui/src/
  styles/globals.css                  # MODIFY: The Seam tokens (dark+light) + shadcn remap
  components/seam.tsx                  # NEW: <Seam state> signature element
  components/copy-button.tsx           # NEW: <CopyButton text>
  components/theme-toggle.tsx          # NEW: <ThemeToggle> (next-themes)
  components/seam.spec.tsx             # NEW: Seam render test
  components/copy-button.spec.tsx      # NEW: CopyButton render test
  vitest.config.mts                    # NEW: jsdom test config for web-ui
apps/web/
  app/layout.tsx                       # MODIFY: fonts + ThemeProvider
  app/(site)/layout.tsx                # NEW: AppShell wrapper for all public pages
  app/(site)/page.tsx                  # home — minimal in T8, POLISHED intro page in T9
  app/(site)/packages/page.tsx         # NEW: package showcase (real registry data)
  app/(site)/packages/[slug]/page.tsx  # NEW: package detail placeholder
  app/(site)/tools/page.tsx            # NEW: tools index (real registry data)
  app/(site)/tools/[slug]/page.tsx     # NEW: tool detail placeholder
  app/(site)/playground/page.tsx       # NEW: playground index placeholder
  app/(site)/templates/page.tsx        # NEW: templates gallery placeholder
  components/layout/app-shell.tsx      # NEW
  components/layout/app-header.tsx     # NEW
  components/layout/app-sidebar.tsx    # NEW
  components/layout/mobile-nav.tsx     # NEW
  components/shared/page-header.tsx    # NEW
  components/shared/tool-card.tsx      # NEW
  components/shared/package-card.tsx   # NEW
  components/home/hero-specimen.tsx    # NEW (T9): static before→after flatten specimen w/ the Seam
  lib/nav.ts                           # NEW: derive sidebar nav from registries
  lib/nav.spec.ts                      # NEW: nav derivation test
  stores/ui-store.ts                   # NEW: Zustand sidebar state
  vitest.config.mts                    # NEW: jsdom test config for apps/web
```

---

### Task 1: Land "The Seam" design tokens + remap shadcn variables

**Files:**
- Modify: `packages/web-ui/src/styles/globals.css`

Replaces the Phase 1 placeholder shadcn-neutral tokens with the six named tokens (both modes) from the design doc §2, and maps shadcn semantic variables onto them so stock components inherit the system. Uses `next-themes` class strategy: `.dark` and explicit `.light` plus a `prefers-color-scheme` default.

- [ ] **Step 1: Rewrite the token + theme layer of `globals.css`**

Keep the file's top (`@import 'tailwindcss';`, `@source '../components';`) and the `@layer base` block at the bottom. Replace everything between them (the `@custom-variant`, `:root`, `.dark`, `@theme inline`) with:

```css
@custom-variant dark (&:is(.dark *));

/* "The Seam" — six named tokens (see docs/superpowers/specs/2026-06-11-web-design-plan.md) */
:root {
  --radius: 0.25rem;

  /* raw palette — light mode default (prefers-color-scheme dark flips below) */
  --bedrock: #f4f6f9;
  --slab: #ffffff;
  --slab-border: #e1e6ee;
  --signal: #1c232e;
  --intake: #2e6cb8;
  --yield: #8f6310;
  --fault: #c2362f;

  /* shadcn semantic vars mapped onto the palette */
  --background: var(--bedrock);
  --foreground: var(--signal);
  --card: var(--slab);
  --card-foreground: var(--signal);
  --popover: var(--slab);
  --popover-foreground: var(--signal);
  --primary: var(--yield);
  --primary-foreground: var(--bedrock);
  --secondary: var(--slab);
  --secondary-foreground: var(--signal);
  --muted: var(--slab);
  --muted-foreground: color-mix(in srgb, var(--signal) 65%, transparent);
  --accent: var(--slab);
  --accent-foreground: var(--signal);
  --destructive: var(--fault);
  --destructive-foreground: var(--bedrock);
  --border: var(--slab-border);
  --input: var(--slab-border);
  --ring: var(--intake);
}

.dark {
  --bedrock: #11151c;
  --slab: #1b212c;
  --slab-border: color-mix(in srgb, #e2e8f1 12%, transparent);
  --signal: #e2e8f1;
  --intake: #6e9bd6;
  --yield: #e8b04b;
  --fault: #ef6f6c;
}

/* honor OS preference when the user has not explicitly chosen a theme */
@media (prefers-color-scheme: dark) {
  :root:not(.light):not(.dark) {
    --bedrock: #11151c;
    --slab: #1b212c;
    --slab-border: color-mix(in srgb, #e2e8f1 12%, transparent);
    --signal: #e2e8f1;
    --intake: #6e9bd6;
    --yield: #e8b04b;
    --fault: #ef6f6c;
  }
}

@theme inline {
  --font-sans: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
  --font-mono: var(--font-mono, ui-monospace, "SF Mono", Menlo, monospace);

  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);

  /* named brand tokens — enable bg-intake / text-yield / border-fault, etc. */
  --color-bedrock: var(--bedrock);
  --color-slab: var(--slab);
  --color-signal: var(--signal);
  --color-intake: var(--intake);
  --color-yield: var(--yield);
  --color-fault: var(--fault);

  /* shadcn semantic colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

- [ ] **Step 2: Verify the build emits brand + semantic utilities**

Run: `pnpm -F web build`
Then confirm the compiled CSS carries both a brand palette token and a remapped shadcn token:

```bash
CSS=$(find apps/web/.next/static -name '*.css' | head -1)
grep -o '\-\-yield:' "$CSS" && grep -o 'var(--primary)' "$CSS" | head -1 && echo "TOKENS OK"
```

Expected: `--yield:`, `var(--primary)`, `TOKENS OK`. Build exits 0.

Note: assert the **raw** brand palette token `--yield` (defined in `:root`, so it always ships) and the shadcn remap `--primary: var(--yield)`, **not** the `@theme inline` namespaced `--color-yield`. Tailwind v4 only emits a `--color-*` custom property when a utility that consumes it (e.g. `bg-intake`/`text-yield`) is generated from scanned source; at Task 1's state no page/component uses the brand utilities yet, so Tailwind tree-shakes the entire brand `--color-*` group out of the bundle. The brand utilities (and thus the `--color-*` group) come online once the `<Seam>` component lands (Task 4 uses `from-intake to-yield`, `text-fault`). This check still proves the build emitted the brand palette token AND the semantic remap — exactly what Step 2 verifies.

- [ ] **Step 3: Verify lint/types still green**

Run: `pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types && pnpm -F web check-types`
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/web-ui/src/styles/globals.css
git commit -m "feat(web-ui): land The Seam design tokens and remap shadcn vars

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire fonts (Archivo + JetBrains Mono)

**Files:**
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Add the font loaders and variables to the root layout**

Replace `apps/web/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "rfjs — RoyFW's TypeScript utility toolkit",
  description:
    "Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

Note: `suppressHydrationWarning` on `<html>` is required by next-themes (Task 3 injects the theme class before hydration).

- [ ] **Step 2: Verify build (fonts fetch at build time)**

Run: `pnpm -F web build`
Expected: exit 0; build log shows no `next/font` errors. (If the sandbox blocks Google Fonts fetch, report it — fonts need network; do not silently swap to a system font.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): wire Archivo and JetBrains Mono via next/font

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Theme provider + toggle (next-themes)

**Files:**
- Create: `packages/web-ui/src/components/theme-toggle.tsx`
- Modify: `apps/web/app/layout.tsx`, `apps/web/package.json`, `packages/web-ui/package.json`

- [ ] **Step 1: Install next-themes and lucide-react**

```bash
pnpm -F web add next-themes
pnpm -F @rfjs/web-ui add lucide-react
```

(Confirm latest stable first: `pnpm view next-themes dist-tags.latest`, `pnpm view lucide-react dist-tags.latest`.)

- [ ] **Step 2: Add `ThemeProvider` to the root layout**

In `apps/web/app/layout.tsx`, add the import and wrap `{children}`:

```tsx
import { ThemeProvider } from "next-themes";
```

```tsx
      <body className={`${archivo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
```

- [ ] **Step 3: Create the theme toggle** — `packages/web-ui/src/components/theme-toggle.tsx`

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "./button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} theme` : "Toggle theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```

Note: rendering the icon only after `mounted` avoids a hydration mismatch (server has no theme). The button itself renders immediately so layout is stable.

- [ ] **Step 4: Verify**

Run: `pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types && pnpm -F web build`
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/package.json packages/web-ui pnpm-lock.yaml
git commit -m "feat(web): add next-themes provider and theme toggle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `<Seam>` signature component (TDD)

**Files:**
- Create: `packages/web-ui/vitest.config.mts`, `packages/web-ui/src/components/seam.tsx`, `packages/web-ui/src/components/seam.spec.tsx`
- Modify: `packages/web-ui/package.json`

Implements the design doc §4: a stateful gradient rule. State is conveyed by line style + chip text (never color/motion alone); the one pulse animation is gated behind `prefers-reduced-motion: no-preference`.

- [ ] **Step 1: Add a jsdom vitest setup to web-ui**

```bash
pnpm -F @rfjs/web-ui add -D vitest @vitest/coverage-istanbul jsdom @testing-library/react @testing-library/dom
```

`packages/web-ui/vitest.config.mts`:

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

Add scripts to `packages/web-ui/package.json` (`"test": "vitest run"`, `"vitest:run": "vitest run"`).

- [ ] **Step 2: Write the failing test** — `packages/web-ui/src/components/seam.spec.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Seam } from "./seam";

describe("Seam", () => {
  it("renders the operation label in a chip", () => {
    render(<Seam state="current" operation="flatten()" />);
    expect(screen.getByText("flatten()")).toBeDefined();
  });

  it("exposes state via data-state for style + tests (not color alone)", () => {
    const { container } = render(<Seam state="stale" operation="flatten()" />);
    expect(container.querySelector('[data-state="stale"]')).not.toBeNull();
  });

  it("shows an ERR chip when state is error", () => {
    render(<Seam state="error" operation="flatten()" />);
    expect(screen.getByText("ERR")).toBeDefined();
  });

  it("marks the decorative rule aria-hidden", () => {
    const { container } = render(<Seam state="current" operation="flatten()" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm -F @rfjs/web-ui vitest:run`
Expected: FAIL — cannot find `./seam`.

- [ ] **Step 4: Implement `<Seam>`** — `packages/web-ui/src/components/seam.tsx`

```tsx
import { cn } from "../lib/utils";

export type SeamState = "current" | "stale" | "running" | "error";

export interface SeamProps {
  state: SeamState;
  operation: string;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

const lineByState: Record<SeamState, string> = {
  current: "border-solid opacity-100",
  stale: "border-dashed opacity-70",
  running: "border-solid opacity-100 motion-safe:animate-pulse",
  error: "border-dotted opacity-80",
};

export function Seam({ state, operation, orientation = "vertical", className }: SeamProps) {
  const isError = state === "error";
  return (
    <div
      data-state={state}
      className={cn(
        "relative flex items-center justify-center",
        orientation === "vertical" ? "h-full w-px flex-col" : "h-px w-full flex-row",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 border-0 bg-gradient-to-b from-intake to-yield",
          orientation === "vertical" ? "w-px border-l" : "h-px border-t bg-gradient-to-r",
          lineByState[state],
        )}
      />
      <span
        className={cn(
          "relative z-10 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] leading-none",
          isError
            ? "border-dashed border-fault bg-bedrock text-fault"
            : "border-border bg-slab text-signal/65",
        )}
      >
        {isError ? "ERR" : `▸ ${operation}`}
      </span>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @rfjs/web-ui vitest:run`
Expected: PASS — 4 tests.

- [ ] **Step 6: Lint + types**

Run: `pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add packages/web-ui/vitest.config.mts packages/web-ui/src/components/seam.tsx packages/web-ui/src/components/seam.spec.tsx packages/web-ui/package.json pnpm-lock.yaml
git commit -m "feat(web-ui): add stateful Seam signature component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: `<CopyButton>` (TDD)

**Files:**
- Create: `packages/web-ui/src/components/copy-button.tsx`, `packages/web-ui/src/components/copy-button.spec.tsx`

- [ ] **Step 1: Write the failing test** — `packages/web-ui/src/components/copy-button.spec.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyButton } from "./copy-button";

describe("CopyButton", () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it("writes the given text to the clipboard on click", async () => {
    const { container } = render(<CopyButton text="hello" label="Copy SQL" />);
    container.querySelector("button")!.click();
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello"));
  });

  it("shows a copied state after clicking", async () => {
    const { container } = render(<CopyButton text="hello" label="Copy SQL" />);
    container.querySelector("button")!.click();
    await waitFor(() => expect(screen.getByText(/copied/i)).toBeDefined());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rfjs/web-ui vitest:run`
Expected: FAIL — cannot find `./copy-button`.

- [ ] **Step 3: Implement** — `packages/web-ui/src/components/copy-button.tsx`

```tsx
"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "./button";

export interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function CopyButton({ text, label = "Copy", className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button variant="outline" size="sm" className={className} onClick={onCopy} aria-live="polite">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rfjs/web-ui vitest:run`
Expected: PASS — Seam (4) + CopyButton (2) = 6 tests.

- [ ] **Step 5: Lint + types, then commit**

```bash
pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types
git add packages/web-ui/src/components/copy-button.tsx packages/web-ui/src/components/copy-button.spec.tsx
git commit -m "feat(web-ui): add CopyButton with copied state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Nav derivation, Zustand store, and card/header primitives (TDD on nav)

**Files:**
- Create: `apps/web/lib/nav.ts`, `apps/web/lib/nav.spec.ts`, `apps/web/stores/ui-store.ts`, `apps/web/components/shared/page-header.tsx`, `apps/web/components/shared/tool-card.tsx`, `apps/web/components/shared/package-card.tsx`, `apps/web/vitest.config.mts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add vitest (jsdom) + zustand to apps/web**

```bash
pnpm -F web add zustand
pnpm -F web add -D vitest jsdom @testing-library/react @testing-library/dom
```

`apps/web/vitest.config.mts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  test: {
    environment: 'jsdom',
    include: ['**/*.spec.(ts|tsx)'],
    exclude: ['node_modules/**', '.next/**'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

Add scripts to `apps/web/package.json`: `"test": "vitest run"`, `"vitest:run": "vitest run"`.

- [ ] **Step 2: Write the failing nav test** — `apps/web/lib/nav.spec.ts`

```ts
import { describe, expect, it } from "vitest";

import { buildSidebarNav } from "./nav";

describe("buildSidebarNav", () => {
  it("groups tools under their related package name", () => {
    const groups = buildSidebarNav();
    const objectUtils = groups.find((g) => g.packageName === "@rfjs/object-utils");
    expect(objectUtils).toBeDefined();
    expect(objectUtils!.tools.map((t) => t.id)).toContain("object-flatten");
  });

  it("every tool appears in exactly one group", () => {
    const groups = buildSidebarNav();
    const ids = groups.flatMap((g) => g.tools.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm -F web vitest:run`
Expected: FAIL — cannot find `./nav`.

- [ ] **Step 4: Implement nav derivation** — `apps/web/lib/nav.ts`

```ts
import { packageRegistry, toolRegistry, type ToolDefinition } from "@rfjs/web-core";

export interface SidebarGroup {
  packageName: string;
  href: string;
  tools: ToolDefinition[];
}

export function buildSidebarNav(): SidebarGroup[] {
  return packageRegistry
    .map((pkg) => ({
      packageName: pkg.name,
      href: pkg.href,
      tools: toolRegistry.filter((t) => t.relatedPackages?.includes(pkg.name)),
    }))
    .filter((group) => group.tools.length > 0);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm -F web vitest:run`
Expected: PASS — 2 tests.

- [ ] **Step 6: Implement the Zustand UI store** — `apps/web/stores/ui-store.ts`

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: "rfjs-ui" },
  ),
);
```

- [ ] **Step 7: Implement `PageHeader`** — `apps/web/components/shared/page-header.tsx`

```tsx
export interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-6 border-b border-border pb-4">
      <h1 className="font-sans text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </header>
  );
}
```

- [ ] **Step 8: Implement `ToolCard`** — `apps/web/components/shared/tool-card.tsx`

```tsx
import type { ToolDefinition } from "@rfjs/web-core";
import { Seam } from "@rfjs/web-ui/components/seam";
import Link from "next/link";

const statusLabel: Record<ToolDefinition["status"], string> = {
  ready: "Ready",
  preview: "Preview",
  planned: "Planned",
};

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link
      href={tool.href}
      className="group flex flex-col gap-3 rounded-md border border-border bg-slab p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-medium">{tool.title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">{statusLabel[tool.status]}</span>
      </div>
      <p className="text-xs text-muted-foreground">{tool.description}</p>
      <div className="h-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Seam state="current" operation={tool.category} orientation="horizontal" />
      </div>
    </Link>
  );
}
```

- [ ] **Step 9: Implement `PackageCard`** — `apps/web/components/shared/package-card.tsx`

```tsx
import type { PackageDefinition } from "@rfjs/web-core";
import Link from "next/link";

export function PackageCard({ pkg }: { pkg: PackageDefinition }) {
  return (
    <Link
      href={pkg.href}
      className="flex flex-col gap-2 rounded-md border border-border bg-slab p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
    >
      <span className="font-mono text-sm text-signal">{pkg.name}</span>
      <p className="text-xs text-muted-foreground">{pkg.description}</p>
    </Link>
  );
}
```

- [ ] **Step 10: Lint + types + commit**

```bash
pnpm -F web lint && pnpm -F web check-types && pnpm -F web vitest:run
git add apps/web/lib apps/web/stores apps/web/components/shared apps/web/vitest.config.mts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add registry-driven nav, ui store, and card primitives

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: AppShell — header + registry-driven sidebar + mobile drawer (RWD)

**Files:**
- Create: `apps/web/components/layout/app-header.tsx`, `app-sidebar.tsx`, `mobile-nav.tsx`, `app-shell.tsx`

- [ ] **Step 1: Implement `AppSidebar`** — `apps/web/components/layout/app-sidebar.tsx`

```tsx
"use client";

import { Seam } from "@rfjs/web-ui/components/seam";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buildSidebarNav } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();
  const groups = buildSidebarNav();
  return (
    <nav aria-label="Tools" className="flex flex-col gap-5 p-4">
      {groups.map((group) => (
        <div key={group.packageName} className="flex flex-col gap-1">
          <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {group.packageName.replace("@rfjs/", "")}
          </span>
          {group.tools.map((tool) => {
            const active = pathname === tool.href;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal"
              >
                <span className="h-4 w-px">
                  {active ? <Seam state="current" operation="" orientation="vertical" /> : null}
                </span>
                {tool.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Implement `MobileNav`** (drawer below `lg`) — `apps/web/components/layout/mobile-nav.tsx`

```tsx
"use client";

import { Button } from "@rfjs/web-ui/components/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { AppSidebar } from "./app-sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-bedrock/70"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 h-full w-72 max-w-[80%] overflow-y-auto border-r border-border bg-slab">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
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

- [ ] **Step 3: Implement `AppHeader`** — `apps/web/components/layout/app-header.tsx`

```tsx
import { Button } from "@rfjs/web-ui/components/button";
import { ThemeToggle } from "@rfjs/web-ui/components/theme-toggle";
import { Github } from "lucide-react";
import Link from "next/link";

import { MobileNav } from "./mobile-nav";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-bedrock/90 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <MobileNav />
        <Link href="/" className="font-mono text-base font-semibold tracking-tight">
          rfjs
        </Link>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="icon" asChild aria-label="GitHub repository">
          <a href="https://github.com/royfw/rfjs" target="_blank" rel="noreferrer">
            <Github className="size-4" />
          </a>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Implement `AppShell`** — `apps/web/components/layout/app-shell.tsx`

```tsx
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bedrock text-foreground">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
          <div className="sticky top-14">
            <AppSidebar />
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Lint + types**

Run: `pnpm -F web lint && pnpm -F web check-types`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/layout
git commit -m "feat(web): add responsive AppShell with registry-driven sidebar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Route group + navigable registry-driven skeleton pages

**Files:**
- Create: `apps/web/app/(site)/layout.tsx`, `apps/web/app/(site)/page.tsx`
- Delete: `apps/web/app/page.tsx` (moves into the `(site)` group)
- Create: `apps/web/app/(site)/packages/page.tsx`, `packages/[slug]/page.tsx`, `tools/page.tsx`, `tools/[slug]/page.tsx`, `playground/page.tsx`, `templates/page.tsx`

- [ ] **Step 1: Create the `(site)` layout that applies the AppShell**

`apps/web/app/(site)/layout.tsx`:

```tsx
import { AppShell } from "@/components/layout/app-shell";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 2: Move the home into the group (interim minimal home; polished version is Task 9)**

```bash
git mv apps/web/app/page.tsx apps/web/app/(site)/page.tsx
```

Replace `apps/web/app/(site)/page.tsx` with an interim minimal home so the build stays green at this commit (Task 9 replaces it with the polished page):

```tsx
import { PageHeader } from "@/components/shared/page-header";

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="rfjs"
        description="Utilities, playgrounds, and developer data tools for the @rfjs/* ecosystem."
      />
      <p className="text-sm text-muted-foreground">Use the navigation to browse the skeleton.</p>
    </>
  );
}
```

- [ ] **Step 3: Packages index** — `apps/web/app/(site)/packages/page.tsx`

```tsx
import { packageRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";

import { PackageCard } from "@/components/shared/package-card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Packages — rfjs" };

export default function PackagesPage() {
  return (
    <>
      <PageHeader title="Packages" description="The @rfjs/* utility toolkit." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {packageRegistry.map((pkg) => (
          <PackageCard key={pkg.name} pkg={pkg} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Package detail placeholder (static params from registry)** — `apps/web/app/(site)/packages/[slug]/page.tsx`

```tsx
import { packageRegistry } from "@rfjs/web-core";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";

export function generateStaticParams() {
  return packageRegistry.map((pkg) => ({ slug: pkg.href.split("/").pop()! }));
}

export default async function PackageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pkg = packageRegistry.find((p) => p.href === `/packages/${slug}`);
  if (!pkg) notFound();
  return (
    <>
      <PageHeader title={pkg.name} description={pkg.description} />
      <p className="text-sm text-muted-foreground">Package detail + playground arrive in a later phase.</p>
    </>
  );
}
```

- [ ] **Step 5: Tools index** — `apps/web/app/(site)/tools/page.tsx`

```tsx
import { toolRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";

export const metadata: Metadata = { title: "Tools — rfjs" };

export default function ToolsPage() {
  return (
    <>
      <PageHeader title="Tools" description="Developer data tools, each powered by an @rfjs/* package." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {toolRegistry.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 6: Tool detail placeholder** — `apps/web/app/(site)/tools/[slug]/page.tsx`

```tsx
import { toolRegistry } from "@rfjs/web-core";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";

export function generateStaticParams() {
  return toolRegistry.map((tool) => ({ slug: tool.href.split("/").pop()! }));
}

export default async function ToolDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolRegistry.find((t) => t.href.endsWith(`/${slug}`));
  if (!tool) notFound();
  return (
    <>
      <PageHeader title={tool.title} description={tool.description} />
      <p className="text-sm text-muted-foreground">
        This tool ships in a later phase (status: {tool.status}).
      </p>
    </>
  );
}
```

Note: tool `href`s point at both `/tools/*` and `/playground/*`; this placeholder backs the `/tools/[slug]` routes. Playground-housed tools are reached via the playground index (Step 7) until those tools are built per-package.

- [ ] **Step 7: Playground + templates index placeholders**

`apps/web/app/(site)/playground/page.tsx`:

```tsx
import { toolRegistry } from "@rfjs/web-core";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";

export const metadata: Metadata = { title: "Playground — rfjs" };

export default function PlaygroundPage() {
  const playgroundTools = toolRegistry.filter((t) => t.href.startsWith("/playground/"));
  return (
    <>
      <PageHeader title="Playground" description="Interactive builders for @rfjs/* workflows." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {playgroundTools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </>
  );
}
```

`apps/web/app/(site)/templates/page.tsx`:

```tsx
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Templates — rfjs" };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader title="Templates" description="start-ts-by project templates." />
      <p className="text-sm text-muted-foreground">
        Template gallery (sourced from templates/registry.json) arrives in a later phase.
      </p>
    </>
  );
}
```

- [ ] **Step 8: Verify build + all routes are generated**

Run: `pnpm -F web build`
Expected: exit 0; the route list includes `/`, `/packages`, `/packages/[slug]`, `/tools`, `/tools/[slug]`, `/playground`, `/templates` (detail routes shown as SSG with generated params).

- [ ] **Step 9: Manual RWD smoke check**

Run `pnpm -F web dev`, then verify at the two breakpoints the design names (375px and 1440px):
- 1440px: sidebar visible, content max-width centered, cards in 3 columns.
- 375px: sidebar hidden, hamburger opens the drawer, cards in 1 column, no horizontal overflow.
- Theme toggle flips dark/light with no flash on reload.

If Playwright/Chrome is unavailable, verify via `curl` that each route returns 200 and the served HTML contains the AppShell header wordmark and the expected card count; report that the visual breakpoint check was substituted. Shut the dev server down afterwards.

- [ ] **Step 10: Lint + types + commit**

```bash
pnpm -F web lint && pnpm -F web check-types
git add apps/web/app
git commit -m "feat(web): add navigable registry-driven route skeleton

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Polished homepage intro page

**Files:**
- Create: `apps/web/components/home/hero-specimen.tsx`
- Modify: `apps/web/app/(site)/page.tsx`

> **Invoke the `frontend-design:frontend-design` skill for this task.** This is the one finished, design-forward page; it must look polished in both themes and at 375px/1440px, following "The Seam" design doc §1 (brand: left becomes right, two directional accents) and §5 (the "bench" layout, hero = transformation specimen). The specimen is **static, hand-authored display content** — it does not import or run `@rfjs/object-utils`; how packages get integrated as live tools is a later per-package discussion.

- [ ] **Step 1: Build the static transformation specimen** — `apps/web/components/home/hero-specimen.tsx`

```tsx
import { Seam } from "@rfjs/web-ui/components/seam";

const INPUT = `{
  "user": {
    "name": "Ada",
    "roles": ["admin", "dev"]
  },
  "active": true
}`;

const OUTPUT = `{
  "user.name": "Ada",
  "user.roles.0": "admin",
  "user.roles.1": "dev",
  "active": true
}`;

function Panel({ tone, label, code }: { tone: "intake" | "yield"; label: string; code: string }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-slab">
      <div
        className={`border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide ${
          tone === "intake" ? "text-intake" : "text-yield"
        }`}
      >
        {label}
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-signal">{code}</pre>
    </div>
  );
}

export function HeroSpecimen() {
  return (
    <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch">
      <Panel tone="intake" label="input" code={INPUT} />
      <div className="flex shrink-0 items-center justify-center lg:px-1">
        <Seam state="current" operation="flatten()" orientation="horizontal" className="lg:hidden" />
        <Seam state="current" operation="flatten()" orientation="vertical" className="hidden lg:flex" />
      </div>
      <Panel tone="yield" label="output" code={OUTPUT} />
    </div>
  );
}
```

- [ ] **Step 2: Assemble the polished homepage** — replace `apps/web/app/(site)/page.tsx`

```tsx
import { packageRegistry } from "@rfjs/web-core";
import { Button } from "@rfjs/web-ui/components/button";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import Link from "next/link";

import { HeroSpecimen } from "@/components/home/hero-specimen";
import { PackageCard } from "@/components/shared/package-card";

const features = [
  { title: "Package Showcase", body: "Every tool is a live demo of an @rfjs/* package.", href: "/packages" },
  { title: "Data Tools", body: "Flatten, convert, decode — all in your browser.", href: "/tools" },
  { title: "Query & Filter Playground", body: "Build filters, compile them to SQL or Mongo.", href: "/playground" },
  { title: "Templates", body: "Scaffold TypeScript projects with start-ts-by.", href: "/templates" },
];

export default function HomePage() {
  const featuredPackages = packageRegistry.filter((p) => p.status === "ready").slice(0, 6);
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-sans text-3xl font-semibold tracking-tight sm:text-4xl">rfjs</h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query
            workflows. Data in one shape, out another — that transformation is the whole site.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/packages">View Packages</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/tools">Browse Tools</Link>
            </Button>
            <CopyButton text="pnpm add @rfjs/object-utils" label="pnpm add @rfjs/object-utils" />
          </div>
        </div>
        <HeroSpecimen />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.title}
            href={f.href}
            className="flex flex-col gap-2 rounded-md border border-border bg-slab p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock"
          >
            <h2 className="font-sans text-sm font-medium">{f.title}</h2>
            <p className="text-xs text-muted-foreground">{f.body}</p>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold">Packages</h2>
          <Link href="/packages" className="font-mono text-xs text-intake hover:underline">
            view all →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featuredPackages.map((pkg) => (
            <PackageCard key={pkg.name} pkg={pkg} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify build + RWD/theme**

Run: `pnpm -F web build` (expect exit 0, `/` Static). Then `pnpm -F web dev` and check at 375px and 1440px: hero panels sit side-by-side with a vertical Seam at `lg+`, stack with a horizontal Seam below; no horizontal overflow; both themes legible; focus rings visible on the CTA buttons and cards. If Chrome/Playwright is unavailable, substitute the `curl` HTML check and report it. Shut the dev server down afterwards.

- [ ] **Step 4: Lint + types**

Run: `pnpm -F web lint && pnpm -F web check-types`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(site)/page.tsx apps/web/components/home
git commit -m "feat(web): build polished homepage intro page with The Seam specimen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Phase 2 monorepo green + handoff note

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: Full monorepo verification**

Run: `pnpm turbo run lint check-types test build`
Expected: all tasks succeed (pre-existing data-filter/orm-app warnings only; 0 errors). Fix or report any red — never claim green without this output.

- [ ] **Step 2: Note the routes in the app README**

Append to `apps/web/README.md` under a new `## Routes` section:

```markdown
## Routes

| Route | State |
|-------|-------|
| `/` | Home — polished intro page |
| `/packages`, `/packages/[slug]` | Package showcase (index real, detail placeholder) |
| `/tools`, `/tools/[slug]` | Tools index (real) + detail placeholders |
| `/playground` | Playground index |
| `/templates` | Templates gallery (placeholder) |

All navigation is driven by the `@rfjs/web-core` registries via `lib/nav.ts`.
Per-package tool/detail pages are designed and built individually in later phases.
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): document the Phase 2 routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Later (per-package, discussed individually — not in this plan)

Each `@rfjs/*` package gets its own tool/detail page, designed in a dedicated discussion when its turn comes. The skeleton + shared primitives from this phase are what those pages slot into. The recurring shape (captured here so the later discussions start from a known pattern, **not** committed to yet):

- A **two-pane `PlaygroundLayout`** (40/60, vertical `<Seam>` between; stacked + rotated Seam below `lg`; per-pane mono status bar).
- A `<JsonInput>` input surface (starts as `<textarea>`; CodeMirror is a later nice-to-have).
- A small per-tool **engine** (`apps/web/features/<tool>/engine.ts`) wrapping the relevant `@rfjs/*` package, with a discriminated `{ ok, value } | { ok: false, error }` result and unit tests.
- Tool config/input persisted to the URL via **nuqs**; `<Seam>` driven through `stale`/`running`/`current`/`error`.
- A "Powered by `@rfjs/<pkg>`" block (npm link, install cmd, equivalent code snippet) + `<CopyButton>` on output.
- Flip that tool's registry `status` to `ready` so it surfaces on the homepage and listings.

`sitemap.ts` / OG images / `PreviewDeviceTabs` / admin remain later-phase items.

---

## Self-Review

- **Scope coverage:** tokens ✓(T1), fonts ✓(T2), theme ✓(T3, next-themes per decision), Seam ✓(T4), CopyButton ✓(T5), nav/store/cards ✓(T6), AppShell + RWD + drawer ✓(T7), all route skeletons registry-driven ✓(T8), **polished homepage ✓(T9)**, green + docs ✓(T10). Honors the locked decisions: 完整 AppShell, 廣度優先 (every planned route navigable), 精美首頁 (T9), and per-package tool pages deferred to later individual discussions.
- **Deliberately deferred (YAGNI here):** per-package tool engines, `PlaygroundLayout`, interactive object-flatten, nuqs/lz-string, CodeMirror, PreviewDeviceTabs, sitemap/OG, admin. The homepage specimen is static so this phase imports/runs no `@rfjs/*` package as a tool.
- **Placeholder scan:** detail-page bodies are intentionally placeholder *content*, but each is complete, compilable code rendering real registry data inside the final shell; the homepage (T9) is fully built, not a placeholder. No `TODO`/`fill-in` code steps; every step shows full code or an exact command.
- **Type consistency:** `buildSidebarNav`/`SidebarGroup`, `useUiStore`, `ToolCard`/`PackageCard`, `HeroSpecimen`, `<Seam state operation orientation className>`, `<CopyButton text label>`, `<ThemeToggle>` names are consistent across tasks; props match the `ToolDefinition`/`PackageDefinition` types exported by `@rfjs/web-core`; `Seam`'s `data-state` is asserted in its test and consumed by the sidebar, cards, and hero specimen.
- **Risk noted:** Tasks 7, 8, 9 produce no unit tests (presentational/RWD); covered by the build + manual breakpoint check (or the curl substitute), and by the T4/T5/T6 unit tests behind the components they compose.
