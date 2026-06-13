# apps/web 收斂（Phase 2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web` 收斂成「內容站 + 快速工具入口」：搬到 src/ layout、sidebar 改平鋪兩段、`/tools` index 區分站內/跨站連結、`/playground` 全區 redirect、`/packages/[slug]` 補實。

**Architecture:** 工具連結改由 registry 的 `surface` 欄位推導（web→站內 `/tools/[id]`、workbench→跨站 `${NEXT_PUBLIC_WORKBENCH_URL}/apps/[id]`），而非依賴 registry 內存的 `href`。sidebar 從「package→tool 巢狀」改為「Packages 平鋪 + Tools 平鋪」兩個獨立區段，移除 `claimed` 去重 hack。

**Tech Stack:** Next 16 App Router / React 19 / next-intl 4 / Tailwind v4 / vitest

**Spec:** `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md` §3（roadmap §13 Phase 2 = §3 的 1/2/4/5/6；**不含**第 3 項「6 個快速工具做成真的」，那是 Phase 4）

**範圍註記：**
- §3.5「最小 code 範例」：本 Phase 只做套件頁的**結構**（install 指令 + npm/GitHub 連結 + 相關工具卡片）；逐套件的 code 範例屬內容工作，延後（追蹤於 follow-up，不在此計畫）。
- registry 的 tool `href` 欄位在本 Phase 後變為 web 不再讀取的 vestigial 欄位（workbench 用 surface+id 自行推導）。移除 schema 欄位留待後續清理，避免本 Phase 動到 web-core schema + packages。

---

### Task 1: apps/web 搬成 src/ layout

**Files:**
- Move: `apps/web/{app,components,i18n,lib,messages,stores,middleware.ts}` → `apps/web/src/`
- Modify: `apps/web/tsconfig.json`, `apps/web/next.config.js`, `apps/web/vitest.config.mts`

- [ ] **Step 1: git mv 來源目錄進 src/（保留歷史）**

```bash
cd apps/web
mkdir src
git mv app components i18n lib messages stores middleware.ts src/
cd ../..
```

（`components.json`、`eslint.config.js`、`next.config.js`、`postcss.config.mjs`、`package.json`、`tsconfig.json`、`vitest.config.mts`、`README.md`、`.gitignore` 維持在 web 根目錄，不移動 — 與 apps/workbench 的 src layout 一致。）

- [ ] **Step 2: 更新 `apps/web/tsconfig.json` 的 paths**

把
```json
    "paths": {
      "@/*": ["./*"]
    }
```
改成
```json
    "paths": {
      "@/*": ["./src/*"]
    }
```

- [ ] **Step 3: 更新 `apps/web/next.config.js` 的 i18n plugin 路徑**

把 `createNextIntlPlugin("./i18n/request.ts")` 改成 `createNextIntlPlugin("./src/i18n/request.ts")`。

- [ ] **Step 4: 更新 `apps/web/vitest.config.mts` 的 alias**

把 `alias: { '@': path.resolve(__dirname, '.') }` 改成 `alias: { '@': path.resolve(__dirname, './src') }`。

- [ ] **Step 5: 確認 components.json 不需改**

`apps/web/components.json` 的 `tailwind.css` 是 `../../packages/web-ui/src/styles/globals.css`（相對 web 根目錄，components.json 沒移動 → 仍正確）；`aliases` 走 tsconfig 的 `@/*`（已在 Step 2 指向 src）。不需改動，僅確認。

- [ ] **Step 6: 清快取並驗證**

```bash
rm -rf apps/web/.next
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build
```
Expected: 全綠；build route table 不變（home/packages/packages[slug]/tools/tools[slug]/playground/playground[slug]/templates × en,zh-TW）。`@/...` import 全數解析。

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "refactor(web): move source into src/ layout

Aligns with the monorepo convention (packages/*, apps/api, apps/workbench
are all src-based); root keeps config files only.

Co-Authored-By: <model> <noreply@anthropic.com>"
```

注意：pre-commit hook 跑 `turbo run lint-staged test --affected`；若失敗於瞬時 pnpm "Unexpected end of JSON input"，原樣重試一次。後續所有 Task 都在 `apps/web/src/` 下作業。

---

### Task 2: `toolHref` 連結推導 helper（TDD）

**Files:**
- Create: `apps/web/src/lib/tool-href.ts`
- Test: `apps/web/src/lib/tool-href.spec.ts`

- [ ] **Step 1: 寫失敗測試** — `tool-href.spec.ts`

```ts
import { describe, expect, it } from "vitest";
import type { ToolDefinition } from "@rfjs/web-core";

import { isExternalTool, toolHref } from "./tool-href";

const webTool: ToolDefinition = {
  id: "jwt-decoder",
  category: "inspect",
  surface: "web",
  href: "/legacy",
  status: "planned",
};
const wbApp: ToolDefinition = {
  id: "data-filter-builder",
  category: "filter",
  surface: "workbench",
  href: "/legacy",
  status: "planned",
};

describe("toolHref", () => {
  it("web tools link internally by id", () => {
    expect(toolHref(webTool)).toBe("/tools/jwt-decoder");
    expect(isExternalTool(webTool)).toBe(false);
  });

  it("workbench apps link cross-site under /apps", () => {
    expect(toolHref(wbApp)).toContain("/apps/data-filter-builder");
    expect(isExternalTool(wbApp)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run`
Expected: FAIL — Cannot find module './tool-href'

- [ ] **Step 3: 實作 `tool-href.ts`**

```ts
import type { ToolDefinition } from "@rfjs/web-core";

// Workbench apps live on a separate origin (its own PWA scope); web quick tools
// are internal routes. The base is overridable per environment; dev defaults to
// the workbench dev server port.
export const workbenchUrl = process.env.NEXT_PUBLIC_WORKBENCH_URL ?? "http://localhost:3001";

export function isExternalTool(tool: ToolDefinition): boolean {
  return tool.surface === "workbench";
}

export function toolHref(tool: ToolDefinition): string {
  return isExternalTool(tool) ? `${workbenchUrl}/apps/${tool.id}` : `/tools/${tool.id}`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/tool-href.ts apps/web/src/lib/tool-href.spec.ts
git commit -m "feat(web): derive tool links from surface (internal vs workbench cross-site)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 3: Sidebar 改平鋪兩段（Packages + Tools），移除 claimed hack（TDD）

**Files:**
- Modify: `apps/web/src/lib/nav.ts`
- Modify: `apps/web/src/lib/nav.spec.ts`
- Modify: `apps/web/src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: 改寫 `nav.spec.ts`** — 取代既有 buildSidebarNav 測試：

```ts
import { describe, expect, it } from "vitest";

import { sidebarPackages, sidebarTools } from "./nav";

describe("sidebar nav", () => {
  it("lists every package", () => {
    expect(sidebarPackages().length).toBeGreaterThanOrEqual(11);
  });

  it("lists only web-surface quick tools (workbench apps excluded)", () => {
    const tools = sidebarTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.every((t) => t.surface === "web")).toBe(true);
    expect(tools.some((t) => t.surface === "workbench")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm -F web vitest:run`
Expected: FAIL — `sidebarPackages`/`sidebarTools` 不存在（且舊的 buildSidebarNav 測試已被取代）

- [ ] **Step 3: 改寫 `nav.ts`** — 整檔取代：

```ts
import { packageRegistry, toolRegistry, type PackageDefinition, type ToolDefinition } from "@rfjs/web-core";

// Flat sidebar sections (the old package→tool nesting + `claimed` dedupe is gone;
// a tool's package association is shown as a badge on the tools index instead).
export function sidebarPackages(): PackageDefinition[] {
  return packageRegistry;
}

export function sidebarTools(): ToolDefinition[] {
  return toolRegistry.filter((tool) => tool.surface === "web");
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm -F web vitest:run`
Expected: PASS

- [ ] **Step 5: 改寫 `app-sidebar.tsx`** — 整檔取代：

```tsx
"use client";

import { Seam } from "@rfjs/web-ui/components/seam";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { sidebarPackages, sidebarTools } from "@/lib/nav";
import { toolHref } from "@/lib/tool-href";

export function AppSidebar() {
  const t = useTranslations("Tools");
  const tNav = useTranslations("Pages");
  const pathname = usePathname();
  const packages = sidebarPackages();
  const tools = sidebarTools();

  const linkClass =
    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake aria-[current=page]:text-signal";
  const seam = (active: boolean) => (
    <span className="h-4 w-px">
      {active ? <Seam state="current" operation="" orientation="vertical" /> : null}
    </span>
  );

  return (
    <nav aria-label={tNav("packagesTitle")} className="flex flex-col gap-5 p-4">
      <div className="flex flex-col gap-1">
        <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {tNav("packagesTitle")}
        </span>
        {packages.map((pkg) => {
          const active = pathname === pkg.href;
          return (
            <Link key={pkg.name} href={pkg.href} aria-current={active ? "page" : undefined} className={linkClass}>
              {seam(active)}
              {pkg.name.replace("@rfjs/", "")}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col gap-1">
        <span className="px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {tNav("toolsTitle")}
        </span>
        {tools.map((tool) => {
          const href = toolHref(tool);
          const active = pathname === href;
          return (
            <Link key={tool.id} href={href} aria-current={active ? "page" : undefined} className={linkClass}>
              {seam(active)}
              {t(`${tool.id}.title`)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web vitest:run`
Expected: 全綠。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/nav.ts apps/web/src/lib/nav.spec.ts apps/web/src/components/layout/app-sidebar.tsx
git commit -m "feat(web): flat Packages + Tools sidebar sections, drop claimed-dedupe nesting

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 4: `/tools` index 區分站內/跨站卡片 + badge

**Files:**
- Modify: `apps/web/src/components/shared/tool-card.tsx`
- Modify: `apps/web/src/app/[locale]/(site)/tools/page.tsx`
- Modify: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`

- [ ] **Step 1: messages 加 badge 文案** — 兩個 locale 的 `Detail` namespace 各加一鍵：

en.json `Detail`: 加 `"workbenchBadge": "Workbench ↗"`
zh-TW.json `Detail`: 加 `"workbenchBadge": "Workbench ↗"`

（兩 locale 值相同；它是站別標記，非翻譯內容。保持兩檔 key 結構一致。）

- [ ] **Step 2: 改寫 `tool-card.tsx`** — 整檔取代（站內用 `Link`、跨站用 `<a target=_blank>`，workbench 顯示 badge）：

```tsx
import type { ToolDefinition } from "@rfjs/web-core";
import { Seam } from "@rfjs/web-ui/components/seam";

import { Link } from "@/i18n/navigation";
import { isExternalTool, toolHref } from "@/lib/tool-href";

const cardClass =
  "group flex flex-col gap-3 rounded-md border border-border bg-slab p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-intake focus-visible:ring-offset-2 focus-visible:ring-offset-bedrock";

export function ToolCard({
  tool,
  title,
  description,
  statusLabel,
  workbenchLabel,
}: {
  tool: ToolDefinition;
  title: string;
  description: string;
  statusLabel: string;
  workbenchLabel: string;
}) {
  const href = toolHref(tool);
  const external = isExternalTool(tool);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-sans text-sm font-medium">{title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground">
          {external ? workbenchLabel : statusLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="h-px opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Seam state="current" operation={tool.category} orientation="horizontal" />
      </div>
    </>
  );

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cardClass}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cardClass}>
      {body}
    </Link>
  );
}
```

- [ ] **Step 3: 更新 `tools/page.tsx`** — 傳入 workbench badge 文案（map 全部 8 個工具，卡片自行區分）：

把現有 `ToolsPage` 內的 `tStatus` 區塊改為同時取 Detail，並把 `workbenchLabel` 傳給卡片：

```tsx
  const t = await getTranslations("Pages");
  const tTools = await getTranslations("Tools");
  const tStatus = await getTranslations("Status");
  const tDetail = await getTranslations("Detail");
  return (
    <>
      <PageHeader title={t("toolsTitle")} description={t("toolsDescription")} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {toolRegistry.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            title={tTools(`${tool.id}.title`)}
            description={tTools(`${tool.id}.description`)}
            statusLabel={tStatus(tool.status)}
            workbenchLabel={tDetail("workbenchBadge")}
          />
        ))}
      </div>
    </>
  );
```

（其餘 imports / generateMetadata 不變。）

- [ ] **Step 4: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build`
Expected: 全綠（i18n 完整性測試覆蓋新 Detail key）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/tool-card.tsx "apps/web/src/app/[locale]/(site)/tools/page.tsx" apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json
git commit -m "feat(web): tools index distinguishes internal tools from workbench apps

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 5: `/playground` 全區 redirect 到 `/tools`

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/playground/page.tsx`
- Delete: `apps/web/src/app/[locale]/(site)/playground/[slug]/page.tsx`（及空的 `[slug]` 目錄）

- [ ] **Step 1: 確認沒有其他地方還連到 /playground**

Run: `grep -rn "/playground\|playgroundTitle\|playgroundDescription\|playgroundComingSoon" apps/web/src --include="*.tsx" --include="*.ts"`
Expected: 只剩 playground 自己的兩個 page（即將處理）+ messages 內的 playground* key。若 app-header / homepage / 其他導覽有 `/playground` 連結，在本 task 一併移除（grep 結果若出現，逐一改掉並在 commit 說明）。messages 內的 `playgroundTitle/Description/ComingSoon` 可保留（無害，未被引用）。

- [ ] **Step 2: 改寫 `playground/page.tsx` 為 redirect**

```tsx
import { redirect } from "@/i18n/navigation";

export default async function PlaygroundPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/tools", locale });
}
```

- [ ] **Step 3: 刪除 playground 工具詳細頁**

```bash
git rm "apps/web/src/app/[locale]/(site)/playground/[slug]/page.tsx"
rmdir "apps/web/src/app/[locale]/(site)/playground/[slug]" 2>/dev/null || true
```

- [ ] **Step 4: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web build`
Expected: build route table 不再有 `/playground/[slug]`；`/playground` 仍存在但為 redirect。

手動（可選，若有乾淨 dev server）：開 `/en/playground` 應 307 到 `/en/tools`。

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/[locale]/(site)/playground"
git commit -m "feat(web): redirect /playground to /tools; remove playground tool pages

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 6: `/packages/[slug]` 補實（install + 連結 + 相關工具）

**Files:**
- Modify: `apps/web/src/app/[locale]/(site)/packages/[slug]/page.tsx`
- Modify: `apps/web/src/messages/en.json`, `apps/web/src/messages/zh-TW.json`

- [ ] **Step 1: messages 加區塊標題** — 兩 locale 的 `Detail` namespace 各加：

en.json `Detail`: `"install": "Install"`, `"relatedTools": "Related tools"`, `"viewOnNpm": "npm"`, `"viewOnGithub": "GitHub"`
zh-TW.json `Detail`: `"install": "安裝"`, `"relatedTools": "相關工具"`, `"viewOnNpm": "npm"`, `"viewOnGithub": "GitHub"`

（保持兩檔 key 結構一致。）

- [ ] **Step 2: 改寫 `packages/[slug]/page.tsx`** — 整檔取代：

```tsx
import { packageRegistry, toolRegistry } from "@rfjs/web-core";
import { CopyButton } from "@rfjs/web-ui/components/copy-button";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { ToolCard } from "@/components/shared/tool-card";
import { packageSlug } from "@/lib/i18n-content";

export function generateStaticParams() {
  return packageRegistry.map((pkg) => ({ slug: pkg.href.split("/").pop()! }));
}

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const pkg = packageRegistry.find((p) => p.href === `/packages/${slug}`);
  if (!pkg) notFound();
  const t = await getTranslations({ locale, namespace: "Packages" });
  const tDetail = await getTranslations({ locale, namespace: "Detail" });
  const tTools = await getTranslations({ locale, namespace: "Tools" });
  const tStatus = await getTranslations({ locale, namespace: "Status" });

  const installCmd = `pnpm add ${pkg.name}`;
  const related = toolRegistry.filter((tool) => tool.relatedPackages?.includes(pkg.name));

  return (
    <>
      <PageHeader title={pkg.name} description={t(`${packageSlug(pkg.name)}.description`)} />

      <section className="mt-2 flex flex-col gap-2">
        <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          {tDetail("install")}
        </h2>
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-slab p-3">
          <code className="font-mono text-sm">{installCmd}</code>
          <CopyButton text={installCmd} label={tDetail("install")} />
        </div>
        <div className="flex gap-3 text-xs">
          {pkg.npm ? (
            <a href={pkg.npm} target="_blank" rel="noreferrer" className="text-intake hover:underline">
              {tDetail("viewOnNpm")}
            </a>
          ) : null}
          {pkg.github ? (
            <a href={pkg.github} target="_blank" rel="noreferrer" className="text-intake hover:underline">
              {tDetail("viewOnGithub")}
            </a>
          ) : null}
        </div>
      </section>

      {related.length > 0 ? (
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {tDetail("relatedTools")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {related.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                title={tTools(`${tool.id}.title`)}
                description={tTools(`${tool.id}.description`)}
                statusLabel={tStatus(tool.status)}
                workbenchLabel={tDetail("workbenchBadge")}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
```

注意：依賴 Task 4 已加的 `Detail.workbenchBadge` 與改寫後的 `ToolCard`（含 `workbenchLabel` prop）。確認 `CopyButton` 的 props 為 `{ text, label }`（見 `packages/web-ui/src/components/copy-button.tsx`）。

- [ ] **Step 3: 驗證**

Run: `pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build`
Expected: 全綠；11 個 `/packages/[slug]` SSG 頁照常產生。

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/[locale]/(site)/packages/[slug]/page.tsx" apps/web/src/messages/en.json apps/web/src/messages/zh-TW.json
git commit -m "feat(web): flesh out package detail (install, npm/github links, related tools)

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

### Task 7: 全面驗證 + README route 表更新

**Files:**
- Modify: `apps/web/README.md`

- [ ] **Step 1: 更新 `apps/web/README.md` 的 Routes 表與 Add 段**

把 README 中 `/playground` 列改為註明已 redirect 到 `/tools`；`/tools` 列註明站內快速工具 + workbench 應用跨站連結；若 README 提到原始碼在根目錄結構，補一句 source 現在位於 `src/`。（僅改與本 Phase 相關的描述，不重寫整份。）

- [ ] **Step 2: 全 web 驗證 sweep**

```bash
rm -rf apps/web/.next
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build
grep -rn "buildSidebarNav\|/playground/" apps/web/src --include="*.tsx" --include="*.ts" || echo "no stale refs"
```
Expected: 全綠；無殘留的 `buildSidebarNav` 或 `/playground/` 連結引用（messages 內的 playground* key 不算，grep 限 .ts/.tsx 程式）。

- [ ] **Step 3: 確認 workbench 未被波及**

```bash
pnpm -F workbench build
```
Expected: 綠（web 的 surface 連結改動不影響 workbench；web-core 未動 schema）。

- [ ] **Step 4: Commit**

```bash
git add apps/web/README.md
git commit -m "docs(web): update routes for src/ layout, /playground redirect, tools split

Co-Authored-By: <model> <noreply@anthropic.com>"
```

---

## Self-Review 紀錄

- **Spec §3 覆蓋**：item1 sidebar（Task 3）、item2 /tools 卡片（Task 4）、item4 /playground redirect（Task 5）、item5 /packages 補實（Task 6，code 範例部分明列延後）、item6 /packages index 不動（無 task = 正確，本就不改）。src/ 搬遷（用戶確認的範圍追加，Task 1）。✓
- **Placeholder 掃描**：每個程式步驟都有完整程式碼；無 TBD。Task 5 Step 1 的「若有其他 /playground 連結則移除」附帶 grep 指令與明確處置，非空泛。✓
- **型別/名稱一致**：`toolHref`/`isExternalTool`/`workbenchUrl`（Task 2 定義，Task 3/4 使用）；`sidebarPackages`/`sidebarTools`（Task 3 定義與使用）；`ToolCard` 新增 `workbenchLabel` prop（Task 4 定義，Task 6 使用）；`Detail.workbenchBadge`（Task 4 加，Task 6 用）。✓
- **依賴順序**：Task 1（src move）必須最先；Task 2（helper）先於 Task 3/4；Task 4（ToolCard 加 prop）先於 Task 6。Task 5/7 可最後。
