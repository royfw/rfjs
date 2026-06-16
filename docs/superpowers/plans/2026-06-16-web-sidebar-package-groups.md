# Web Sidebar Package Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the `apps/web` left sidebar from two flat lists (Packages + Tools) into a single tree grouped by `@rfjs/*` package, where each package with at least one web tool is a group header linking to its package page, with its tools nested underneath.

**Architecture:** Pure data-shaping lives in `apps/web/src/lib/nav.ts` (`sidebarToolGroups()`), which folds `toolRegistry` into `{ pkg, tools }[]` keyed by each tool's primary package (`relatedPackages[0]`), in `packageRegistry` order, emitting only packages that have web tools. The `AppSidebar` component renders that shape; it holds no grouping logic. The grouping data (`relatedPackages`) already exists in `@rfjs/web-core` — this is a presentation change, not a data-model change.

**Tech Stack:** Next.js (App Router) + next-intl, TypeScript, Vitest, `@rfjs/web-core` registry, `@rfjs/web-ui` (Seam component).

---

## Reference — current state

- Sidebar component: `apps/web/src/components/layout/app-sidebar.tsx` — renders a `Packages` section (`sidebarPackages()` → whole `packageRegistry`) and a flat `Tools` section (`sidebarTools()` → web tools).
- Data source: `apps/web/src/lib/nav.ts` exports `sidebarPackages()` and `sidebarTools()`. **These two functions are used ONLY by the sidebar component and `nav.spec.ts`** — after this change they are dead and get replaced by `sidebarToolGroups()`.
- Registry types (from `@rfjs/web-core`): `ToolDefinition` has `id`, `surface: 'web' | 'workbench'`, `relatedPackages?: string[]`. `PackageDefinition` has `name`, `href`, `status`.
- i18n: section labels come from `useTranslations("Pages")` → `Pages.toolsTitle` / `Pages.packagesTitle`. Tool titles come from `useTranslations("Tools")` → `Tools.<id>.title` (deep-merged from tool feature folders). **No new i18n keys are needed.**
- `toolHref(tool)` (`apps/web/src/lib/tool-href.ts`) returns `/tools/<id>` for web tools.

Expected groups from the current registry (group order = registry order):

| Group (package) | web tools |
| --- | --- |
| data-filter | data-filter-tester |
| data-transform | type-converter |
| jsonb-query | jsonb-query-generator, query-builder |
| jwt | jwt-decoder |
| mongo-query | mongo-query-generator |
| object-utils | object-flatten |

Excluded (no web tool): `data-label`, `pg-toolkit`, `retry`, `tpl-toolkit`. Excluded (workbench surface): `data-filter-builder`, `object-transformer`.

No changeset is required — `apps/web` is a private app, not a published package.

---

## Task 1: Set up the worktree

**Files:** none (git/worktree operations only).

- [ ] **Step 1: Remove the stale, already-merged worktree**

The `feat+web-feature-folders` worktree/branch shipped in PR #169 and is merged into `main`.

Run:
```bash
cd /home/royfw/_/code/royfw/rfjs
git worktree remove .claude/worktrees/feat+web-feature-folders
git branch -d worktree-feat+web-feature-folders
```
Expected: worktree removed; `Deleted branch worktree-feat+web-feature-folders`. If `git branch -d` reports "not fully merged" (it should be merged), stop and investigate rather than force-deleting.

- [ ] **Step 2: Confirm `main` has the spec and this plan committed**

Run:
```bash
git -C /home/royfw/_/code/royfw/rfjs log --oneline -3
git -C /home/royfw/_/code/royfw/rfjs status --short
```
Expected: recent commits include the design spec and this plan; working tree clean.

- [ ] **Step 3: Create the feature worktree from main**

Run:
```bash
git -C /home/royfw/_/code/royfw/rfjs worktree add -b feat/web-sidebar-package-groups \
  .claude/worktrees/feat+web-sidebar-package-groups main
```
Expected: new worktree at `.claude/worktrees/feat+web-sidebar-package-groups` on branch `feat/web-sidebar-package-groups`.

- [ ] **Step 4: Install deps in the worktree (pnpm workspace)**

Run:
```bash
cd /home/royfw/_/code/royfw/rfjs/.claude/worktrees/feat+web-sidebar-package-groups
pnpm install
```
Expected: install completes (lockfile already satisfied → fast).

> **All remaining tasks run inside the worktree** at `.claude/worktrees/feat+web-sidebar-package-groups`. Paths below are relative to that worktree root.

---

## Task 2: Add `sidebarToolGroups()` (TDD)

**Files:**
- Modify: `apps/web/src/lib/nav.ts`
- Test: `apps/web/src/lib/nav.spec.ts` (replace existing contents)

- [ ] **Step 1: Replace `nav.spec.ts` with tests for the new function**

Write `apps/web/src/lib/nav.spec.ts` (full file — the old `sidebarPackages`/`sidebarTools` tests are dropped because those functions are being removed):

```ts
import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { describe, expect, it } from "vitest";

import { sidebarToolGroups } from "./nav";

describe("sidebarToolGroups", () => {
  it("emits groups in packageRegistry order, only packages that have web tools", () => {
    const webPrimaries = new Set(
      toolRegistry.filter((t) => t.surface === "web").map((t) => t.relatedPackages?.[0]),
    );
    const expected = packageRegistry.map((p) => p.name).filter((name) => webPrimaries.has(name));

    expect(sidebarToolGroups().map((g) => g.pkg.name)).toEqual(expected);
    // a lib-only package with no web tool must not appear
    expect(sidebarToolGroups().some((g) => g.pkg.name === "@rfjs/pg-toolkit")).toBe(false);
  });

  it("places every web tool under exactly one group (no orphans, no dupes)", () => {
    const webIds = toolRegistry
      .filter((t) => t.surface === "web")
      .map((t) => t.id)
      .sort();
    const groupedIds = sidebarToolGroups()
      .flatMap((g) => g.tools.map((t) => t.id))
      .sort();

    expect(groupedIds).toEqual(webIds);
  });

  it("places a multi-package tool under its primary package only", () => {
    const groups = sidebarToolGroups();
    const jsonb = groups.find((g) => g.pkg.name === "@rfjs/jsonb-query");
    const dataFilter = groups.find((g) => g.pkg.name === "@rfjs/data-filter");

    expect(jsonb?.tools.map((t) => t.id)).toContain("query-builder");
    expect(dataFilter?.tools.map((t) => t.id) ?? []).not.toContain("query-builder");
  });

  it("keeps tools within a group in toolRegistry order", () => {
    const jsonb = sidebarToolGroups().find((g) => g.pkg.name === "@rfjs/jsonb-query");
    expect(jsonb?.tools.map((t) => t.id)).toEqual(["jsonb-query-generator", "query-builder"]);
  });

  it("excludes workbench-surface tools", () => {
    const ids = sidebarToolGroups().flatMap((g) => g.tools.map((t) => t.id));
    expect(ids).not.toContain("data-filter-builder");
    expect(ids).not.toContain("object-transformer");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
pnpm -F web vitest:run nav.spec.ts
```
Expected: FAIL — `sidebarToolGroups` is not exported from `./nav` (import/type error or "is not a function").

- [ ] **Step 3: Replace `nav.ts` with the new shaping function**

Write `apps/web/src/lib/nav.ts` (full file — removes the now-dead `sidebarPackages`/`sidebarTools`):

```ts
import { packageRegistry, toolRegistry, type PackageDefinition, type ToolDefinition } from "@rfjs/web-core";

export type SidebarToolGroup = {
  pkg: PackageDefinition;
  tools: ToolDefinition[];
};

// Sidebar tree: each @rfjs package that has at least one web tool becomes a
// group, keyed by the tool's primary package (relatedPackages[0]). Group order
// follows packageRegistry (curated); tool order within a group follows
// toolRegistry. Packages with no web tool are omitted (reachable via /packages).
export function sidebarToolGroups(): SidebarToolGroup[] {
  const webTools = toolRegistry.filter((tool) => tool.surface === "web");

  return packageRegistry
    .map((pkg) => ({
      pkg,
      tools: webTools.filter((tool) => tool.relatedPackages?.[0] === pkg.name),
    }))
    .filter((group) => group.tools.length > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
pnpm -F web vitest:run nav.spec.ts
```
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/nav.ts apps/web/src/lib/nav.spec.ts
git commit -m "feat(web): group sidebar tools by primary @rfjs package"
```

---

## Task 3: Render the package tree in `AppSidebar`

**Files:**
- Modify: `apps/web/src/components/layout/app-sidebar.tsx` (full rewrite of the component body)

- [ ] **Step 1: Rewrite the sidebar component**

Write `apps/web/src/components/layout/app-sidebar.tsx` (full file):

```tsx
"use client";

import { Seam } from "@rfjs/web-ui/components/seam";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { sidebarToolGroups } from "@/lib/nav";
import { toolHref } from "@/lib/tool-href";

export function AppSidebar() {
  const t = useTranslations("Tools");
  const tNav = useTranslations("Pages");
  const pathname = usePathname();
  const groups = sidebarToolGroups();

  const toolLinkClass =
    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal";
  const headerLinkClass =
    "rounded-sm px-2 py-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal";
  const seam = (active: boolean) => (
    <span className="h-4 w-px">
      {active ? <Seam state="current" operation="" orientation="vertical" /> : null}
    </span>
  );

  return (
    <nav aria-label={tNav("toolsTitle")} className="flex flex-col gap-5 p-4">
      {groups.map(({ pkg, tools }) => {
        const pkgActive = pathname === pkg.href;
        return (
          <div key={pkg.name} className="flex flex-col gap-1">
            <Link
              href={pkg.href}
              aria-current={pkgActive ? "page" : undefined}
              className={headerLinkClass}
            >
              {pkg.name.replace("@rfjs/", "")}
            </Link>
            {tools.map((tool) => {
              const href = toolHref(tool);
              const active = pathname === href;
              return (
                <Link
                  key={tool.id}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={toolLinkClass}
                >
                  {seam(active)}
                  {t(`${tool.id}.title`)}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
```

Notes for the implementer:
- The package name becomes a clickable group header (`/packages/<slug>`); web tools are internal `/tools/<id>` links via `toolHref`.
- Section labels `Pages.packagesTitle` / the old flat `Tools` heading are gone; one `aria-label` (`Pages.toolsTitle`) names the whole nav. No new i18n keys.
- Active highlight (`aria-current` + `Seam`) is preserved for both header and tool links.

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm -F web check-types
```
Expected: PASS, no errors. (Catches any prop/type mismatch in the component.)

- [ ] **Step 3: Lint**

Run:
```bash
pnpm -F web lint
```
Expected: PASS, no warnings (eslint runs with `--max-warnings 0`). Confirms no unused imports (`sidebarPackages`/`sidebarTools` are no longer referenced anywhere).

- [ ] **Step 4: Build**

Run:
```bash
pnpm -F web build
```
Expected: Next.js build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat(web): render sidebar as @rfjs package tree"
```

---

## Task 4: Full verification

**Files:** none.

- [ ] **Step 1: Run the web test suite**

Run:
```bash
pnpm -F web vitest:run
```
Expected: all tests pass (including `nav.spec.ts` and unchanged tool specs).

- [ ] **Step 2: Manual smoke check (optional but recommended)**

Run:
```bash
pnpm -F web dev
```
Then open `http://localhost:3000`, confirm the sidebar shows 6 package groups in registry order, `jsonb-query` lists both `JSONB Query Generator` and `Query Builder`, clicking a package header navigates to `/packages/<slug>`, and the active tool/package highlights correctly. Stop the dev server when done.

- [ ] **Step 3: Verify the diff scope**

Run:
```bash
git diff --stat main...HEAD
```
Expected: only `apps/web/src/lib/nav.ts`, `apps/web/src/lib/nav.spec.ts`, `apps/web/src/components/layout/app-sidebar.tsx` changed (plus the spec/plan docs already on main).

---

## Self-Review (completed during plan authoring)

- **Spec coverage:** data shaping in `lib/nav.ts` (Task 2) ✓; package-tree render (Task 3) ✓; no new i18n keys (Task 3 note) ✓; only-packages-with-web-tools + registry order + primary-package + no-orphans tests (Task 2) ✓; folder structure unchanged (only 3 files) ✓; worktree cleanup + create (Task 1) ✓.
- **Placeholder scan:** none — every code/test step has full content.
- **Type consistency:** `SidebarToolGroup { pkg, tools }` defined in Task 2, consumed with the same `pkg`/`tools` destructuring in Task 3; `sidebarToolGroups` named identically throughout.
