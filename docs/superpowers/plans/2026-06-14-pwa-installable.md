# PWA 4a — 可安裝（manifest + 生成 icon，雙站）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** apps/web 與 apps/workbench 各加 Next 16 原生 `app/manifest.ts` + 用 `ImageResponse` 從「rfjs」wordmark 生成的 192/512 icon，讓兩站在現代 Chromium/Safari 可安裝（不需 service worker）。

**Architecture:** 每站自帶一份 `manifest.ts`（app root，非 `[locale]` 下，serve 為 `/manifest.webmanifest`）+ 兩個 icon route handler 放在**含點路徑**（`app/icon-192.png/route.tsx`、`app/icon-512.png/route.tsx`）以天然避開 next-intl middleware matcher（它排除含 `.` 的路徑）。icon 內容由各站一個本地 render helper 產生（深底 `#11151c` + 淺墨 `#e2e8f1` wordmark）。無 service worker、無離線快取（那是 4b）。不抽跨套件共用 factory（YAGNI；兩站各一份）。

**Tech Stack:** Next 16 App Router / `next/og` ImageResponse / next-intl 4

**Spec:** `docs/superpowers/specs/2026-06-13-workbench-and-web-convergence-design.md` §8（4a）

**範圍：** 僅「可安裝」（manifest + 192/512 icon + iOS apple-touch-icon link）。**不含** service worker / 離線（4b）、maskable icon（follow-up）、manifest 多語系（manifest 用預設 en，非 localized）。

**慣例：** commit subject 小寫開頭（commitlint `subject-case`）。Co-Authored-By 依執行者模型。pre-commit 跑 `turbo run lint-staged test --affected`；瞬時 pnpm "Unexpected end of JSON input" → 重試一次。**worktree 提醒：** 本 plan 在 worktree 執行，若 `@rfjs/*` 解析失敗先 `pnpm build:packages`。

---

### Task 1: apps/web manifest + 生成 icon（建立並驗證 pattern）

**Files:**
- Create: `apps/web/src/app/manifest.ts`
- Create: `apps/web/src/app/_pwa/icon.tsx`（本地 render helper，非 route）
- Create: `apps/web/src/app/icon-192.png/route.tsx`
- Create: `apps/web/src/app/icon-512.png/route.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`（metadata 加 apple-touch-icon）

- [ ] **Step 1: icon render helper** `apps/web/src/app/_pwa/icon.tsx`

```tsx
import { ImageResponse } from "next/og";

// Brand-colored wordmark icon, generated at build (no static asset, no design tool).
// Dark bedrock background + light signal ink — matches the apps' dark default.
export function renderWordmarkIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#11151c",
          color: "#e2e8f1",
          fontFamily: "monospace",
          fontWeight: 700,
          fontSize: Math.round(size * 0.34),
          letterSpacing: "-0.02em",
        }}
      >
        rfjs
      </div>
    ),
    { width: size, height: size },
  );
}
```

（`_pwa` 前綴底線使其為 Next 的 private folder，不會被當成 route。）

- [ ] **Step 2: 兩個 icon route**

`apps/web/src/app/icon-192.png/route.tsx`
```tsx
import { renderWordmarkIcon } from "../_pwa/icon";

export const dynamic = "force-static";

export function GET() {
  return renderWordmarkIcon(192);
}
```

`apps/web/src/app/icon-512.png/route.tsx`
```tsx
import { renderWordmarkIcon } from "../_pwa/icon";

export const dynamic = "force-static";

export function GET() {
  return renderWordmarkIcon(512);
}
```

- [ ] **Step 3: `apps/web/src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rfjs — TypeScript utility toolkit",
    short_name: "rfjs",
    description:
      "Utilities and developer data tools for JSON, objects, filters, and query workflows.",
    start_url: "/",
    display: "standalone",
    background_color: "#11151c",
    theme_color: "#11151c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 4: layout 加 apple-touch-icon** — `apps/web/src/app/[locale]/layout.tsx` 的 `metadata` 物件加 `icons`：

```tsx
export const metadata: Metadata = {
  title: "rfjs — RoyFW's TypeScript utility toolkit",
  description:
    "Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query workflows.",
  icons: { apple: "/icon-192.png" },
};
```

（其餘 layout 不動。）

- [ ] **Step 5: build + 驗證 served URL 與 middleware 不攔截**

```bash
pnpm -F web build
pnpm -F web start --port 3022 &   # 等 ~3s
sleep 4
curl -s -o /dev/null -w "manifest: %{http_code} %{content_type}\n" http://localhost:3022/manifest.webmanifest
curl -s -o /dev/null -w "icon192: %{http_code} %{content_type}\n" http://localhost:3022/icon-192.png
curl -s -o /dev/null -w "icon512: %{http_code} %{content_type}\n" http://localhost:3022/icon-512.png
curl -s http://localhost:3022/manifest.webmanifest | head -c 400; echo
# 收掉 server
kill %1 2>/dev/null
```
Expected:
- manifest: `200 application/manifest+json`（或 `application/json`），JSON 含 name/icons
- icon192/icon512: `200 image/png`
- **若 icon route 回 200 但被本地化重導（content_type 變 text/html 或 30x）**，代表 middleware 攔到了。退而修 `apps/web/src/middleware.ts` matcher，把 icon 路徑加入排除：
  ```ts
  matcher: "/((?!api|_next|_vercel|icon-|manifest|.*\\..*).*)",
  ```
  （含點路徑本應已被 `.*\\..*` 排除；此為保險。重 build 再驗一次。）在報告中註明是否需要此修正。

- [ ] **Step 6: lint/types**

```bash
pnpm -F web check-types && pnpm -F web lint
```
Expected: 綠。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/manifest.ts apps/web/src/app/_pwa apps/web/src/app/icon-192.png apps/web/src/app/icon-512.png "apps/web/src/app/[locale]/layout.tsx"
# 若改了 middleware：git add apps/web/src/middleware.ts
git commit -m "$(cat <<'EOF'
feat(web): add PWA manifest and generated app icons (installable)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
（瞬時 pnpm hook 錯 → 重試一次。）

## 報告
Status；served URL 驗證結果（manifest/icon 的 code + content_type）；是否需要 middleware 修正；files；commit SHA；self-review；concerns。

---

### Task 2: apps/workbench manifest + 生成 icon（鏡像 web 已驗證的 pattern）

**Files:**
- Create: `apps/workbench/src/app/manifest.ts`
- Create: `apps/workbench/src/app/_pwa/icon.tsx`
- Create: `apps/workbench/src/app/icon-192.png/route.tsx`
- Create: `apps/workbench/src/app/icon-512.png/route.tsx`
- Modify: `apps/workbench/src/app/[locale]/layout.tsx`

- [ ] **Step 1: icon render helper** `apps/workbench/src/app/_pwa/icon.tsx`

與 web 的 `_pwa/icon.tsx` **內容相同**（深底 wordmark "rfjs"）。逐字複製 Task 1 Step 1 的 `renderWordmarkIcon`。

- [ ] **Step 2: 兩個 icon route**（與 web 相同）

`apps/workbench/src/app/icon-192.png/route.tsx` 與 `icon-512.png/route.tsx` —— 內容與 Task 1 Step 2 完全相同（`import { renderWordmarkIcon } from "../_pwa/icon"`、`force-static`、`GET` 回對應尺寸）。

- [ ] **Step 3: `apps/workbench/src/app/manifest.ts`**

```ts
import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rfjs workbench",
    short_name: "workbench",
    description: "Dataset-driven workbench composing the @rfjs packages.",
    start_url: "/",
    display: "standalone",
    background_color: "#11151c",
    theme_color: "#11151c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 4: layout 加 apple-touch-icon** — `apps/workbench/src/app/[locale]/layout.tsx` 的 `metadata` 加 `icons: { apple: "/icon-192.png" }`（其餘不動）。

- [ ] **Step 5: 若 Task 1 需要 middleware 修正，workbench 比照修** `apps/workbench/src/middleware.ts`（同樣的 matcher）。否則跳過。

- [ ] **Step 6: build + 驗證**

```bash
pnpm -F workbench build
pnpm -F workbench start --port 3023 &
sleep 4
curl -s -o /dev/null -w "manifest: %{http_code} %{content_type}\n" http://localhost:3023/manifest.webmanifest
curl -s -o /dev/null -w "icon192: %{http_code} %{content_type}\n" http://localhost:3023/icon-192.png
curl -s http://localhost:3023/manifest.webmanifest | head -c 300; echo
kill %1 2>/dev/null
pnpm -F workbench check-types && pnpm -F workbench lint
```
Expected: manifest 200 + JSON（name "rfjs workbench"）；icon 200 image/png；types/lint 綠。

- [ ] **Step 7: Commit**

```bash
git add apps/workbench/src/app/manifest.ts apps/workbench/src/app/_pwa apps/workbench/src/app/icon-192.png apps/workbench/src/app/icon-512.png "apps/workbench/src/app/[locale]/layout.tsx"
git commit -m "$(cat <<'EOF'
feat(workbench): add PWA manifest and generated app icons (installable)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## 報告
Status；workbench manifest/icon 驗證；middleware 是否需改；files；commit SHA；self-review；concerns。

---

### Task 3: 雙站驗證（含真實瀏覽器 installability）+ README

**Files:**
- Modify: `apps/web/README.md`、`apps/workbench/README.md`

- [ ] **Step 1: 全 sweep**

```bash
pnpm -F web check-types && pnpm -F web lint && pnpm -F web test && pnpm -F web build
pnpm -F workbench check-types && pnpm -F workbench lint && pnpm -F workbench test && pnpm -F workbench build
```
Expected: 全綠（PWA 變更不影響既有測試）。

- [ ] **Step 2: 真實瀏覽器 installability 驗證**（環境有 Playwright chromium）

啟 `pnpm -F web start --port 3022 &`（sleep 4）。用 chromium（executablePath `/home/royfw/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome`、playwright 於 `/home/royfw/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.js`）對 `http://localhost:3022/en`：
- 確認頁面 `<link rel="manifest">` 存在且 href 指向 `/manifest.webmanifest`
- fetch `/manifest.webmanifest` → 解析 JSON，斷言 `name`、`display==="standalone"`、`icons` 有 192 與 512、`start_url`
- fetch `/icon-192.png` 與 `/icon-512.png` → 確認 200 且 `content-type: image/png`、body 非空
- 收掉 server。workbench 同樣方式對 port 3023 驗一輪（name 為 "rfjs workbench"）。
若無法跑瀏覽器，至少以 curl 完成上述 fetch 斷言，並註明 manual install-prompt 確認 pending。

- [ ] **Step 3: README**（兩站）— 各加一行說明已是可安裝 PWA（manifest + 生成 icon），離線 SW 為後續（4b）。僅加相關行。

- [ ] **Step 4: Commit**

```bash
git add apps/web/README.md apps/workbench/README.md
git commit -m "$(cat <<'EOF'
docs(web,workbench): note installable PWA (manifest + icons); offline SW deferred

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## 報告
Status；雙站 sweep + 瀏覽器/curl 驗證結果（manifest 欄位、icon content-type）；files；commit SHA；concerns。

---

## Self-Review 紀錄

- **Spec §8 4a 覆蓋**：兩站 manifest（Task1/2）✓、生成 icon 192/512（Task1/2）✓、dark `#11151c` 底色 ✓、可安裝不需 SW ✓、各自一份不抽 factory ✓、apple-touch-icon（iOS）✓。4b（SW/離線）明確不在範圍 ✓。
- **Placeholder 掃描**：每步有完整程式碼；middleware 修正附確切 matcher，非「視情況處理」。
- **型別/名稱一致**：`renderWordmarkIcon(size)`（Task1 定義、icon routes 與 workbench 共用同簽名）；manifest icon `src` `/icon-192.png`/`/icon-512.png` 與 route 路徑一致；`force-static` 一致。
- **依賴順序**：Task 1 先（建立並實測 pattern + 決定 middleware 是否要改）→ Task 2 鏡像（沿用 Task 1 的 middleware 決定）→ Task 3 雙站驗證。
- **關鍵風險已設防**：next-intl matcher × 含點 icon 路徑（Task 1 Step 5 實測 + 確切退路 matcher）。`next/og` ImageResponse 為 Next 16 內建（無新依賴）；`_pwa` 底線資料夾不被當 route。
