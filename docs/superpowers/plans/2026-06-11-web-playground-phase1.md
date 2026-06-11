# rfjs Web Playground — Phase 1(地基)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web` 從 Turbo 範本清成 rfjs web playground 的乾淨地基:移除三個 Turbo 原生 `@repo/*` 套件、升級依賴、建立 `@rfjs/web-core`(registry)與 `@rfjs/web-ui`(Tailwind + shadcn)、產出設計計畫定稿。

**Architecture:** 三個 Turbo 原生套件(`@repo/ui`、`@repo/typescript-config`、`@repo/eslint-config`)只被 web 範本叢集使用,全部移除;web 叢集改用 repo 既有的 self-contained config 慣例。新內部包以 `@rfjs/` 前綴命名、標 `private: true`(`changeset publish` 會跳過 private,不會誤發佈)。registry 是 single source of truth,以 zod schema 驗證 + vitest 測試。

**Tech Stack:** Next.js App Router(最新穩定版)、TypeScript strict、Tailwind CSS v4(CSS-first `@theme`)、shadcn/ui、zod、Vitest。

**範圍註記(scope check):** 原始需求有 5 個 phase。本計劃只涵蓋 **Phase 1(地基)**,結束時產出可 build、可測試的地基 + 設計計畫(stop gate,等用戶確認)。Phase 2(首頁 + object-flatten 垂直切片)、Phase 3–5 各自另開計劃 — 屆時才引入 nuqs、RHF、Zustand、CodeMirror、lz-string(YAGNI,Phase 1 不裝用不到的依賴)。

**盤點結論(2026-06-11,base = main @ d25545d):**

| 套件 | 使用者 | 處置 |
|---|---|---|
| `@repo/ui` | 只有 `apps/web`(範本頁 1 個 Button) | **移除**,由 `@rfjs/web-ui` 取代 |
| `@repo/typescript-config` | 只有 `apps/web` + `packages/ui` | **移除**,tsconfig inline 進各包(repo 其他包本來就 self-contained) |
| `@repo/eslint-config` | 只有 `apps/web` + `packages/ui` | **移除**,eslint flat config inline 進各包 |

其他事實:`pnpm-workspace.yaml` globs(`packages/*`)會自動納入新包;`packages/data-label`(0.0.0, public)存在但 CLAUDE.md 未列,registry 要納入;`apps/web` 無 test script,vitest 接線在 `@rfjs/web-core` 起步;repo vitest 慣例見 `packages/data-filter/vitest.config.mts`。

**Commit 慣例:** conventional commits(commitlint 強制),所有 commit 結尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。本 plan 的包都是 private / app,**不需 changeset**。pre-commit hook 會跑 `turbo run lint-staged test --affected`。

---

### Task 1: 移除 @repo/* 三包、清空 web 範本

**Files:**
- Delete: `packages/ui/`、`packages/typescript-config/`、`packages/eslint-config/`
- Delete: `apps/web/app/page.module.css`、`apps/web/app/fonts/`、`apps/web/public/*.svg`
- Modify: `apps/web/package.json`、`apps/web/tsconfig.json`、`apps/web/eslint.config.js`、`apps/web/app/layout.tsx`、`apps/web/app/page.tsx`、`apps/web/app/globals.css`

- [ ] **Step 1: 刪除三個範本套件與範本資產**

```bash
rm -rf packages/ui packages/typescript-config packages/eslint-config
rm -rf apps/web/app/fonts apps/web/app/page.module.css
rm -f apps/web/public/*.svg
```

- [ ] **Step 2: 改寫 `apps/web/package.json`**(拿掉 `@repo/*` 依賴,eslint 改自帶;版本先維持現狀,Task 2 才升級)

```json
{
  "name": "web",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@next/eslint-plugin-next": "^15.1.6",
    "@types/node": "^22",
    "@types/react": "19.0.8",
    "@types/react-dom": "19.0.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "globals": "^15.14.0",
    "typescript": "5.7.3",
    "typescript-eslint": "^8.24.0"
  }
}
```

- [ ] **Step 3: 改寫 `apps/web/tsconfig.json`**(inline 原 `@repo/typescript-config` 的 base + nextjs 內容,加 `@/*` alias 供 shadcn 用)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "preserve",
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "incremental": false,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", "next.config.js", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: 改寫 `apps/web/eslint.config.js`**(inline 原 `@repo/eslint-config/next-js`;拿掉 `eslint-plugin-only-warn` 與 `eslint-plugin-turbo` — only-warn 是範本把 error 降級的 quirk,repo 其他包不用)

```js
import js from "@eslint/js";
import pluginNext from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
  {
    plugins: { "@next/next": pluginNext },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs["core-web-vitals"].rules,
    },
  },
  {
    plugins: { "react-hooks": pluginReactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
  eslintConfigPrettier,
  { ignores: [".next/**", "next-env.d.ts"] },
];
```

- [ ] **Step 5: 改寫 `apps/web/app/layout.tsx`**(拿掉本地字體,最小殼)

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rfjs — RoyFW's TypeScript utility toolkit",
  description:
    "Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: 改寫 `apps/web/app/page.tsx`**(暫時的最小首頁,Phase 2 才做正式版)

```tsx
export default function HomePage() {
  return (
    <main>
      <h1>rfjs</h1>
      <p>RoyFW&apos;s TypeScript utility toolkit — site under construction.</p>
    </main>
  );
}
```

- [ ] **Step 7: 清空 `apps/web/app/globals.css`**(Task 4 會換成 `@rfjs/web-ui` 的樣式入口)

```css
/* Tailwind 接線於 @rfjs/web-ui 完成後匯入(見 Task 4) */
```

- [ ] **Step 8: 重新安裝並驗證**

```bash
pnpm install
pnpm -F web lint && pnpm -F web check-types && pnpm -F web build
```

Expected: 三項皆 exit 0;build 輸出 `/` 與 `/_not-found` 兩條靜態路由。

- [ ] **Step 9: 確認 monorepo 不受影響**(其他包沒人依賴被刪的三包,應全綠)

```bash
pnpm turbo run lint check-types --filter='!web'
```

Expected: 全綠,無 `@repo/ui`、`@repo/typescript-config`、`@repo/eslint-config` 解析錯誤。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(web): remove turbo template packages and reset web shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 升級 web 依賴至最新穩定版

**Files:**
- Modify: `apps/web/package.json`(經 pnpm 指令)、`pnpm-lock.yaml`

- [ ] **Step 1: 查最新穩定版**(不憑記憶)

```bash
pnpm view next dist-tags.latest
pnpm view react dist-tags.latest
pnpm view typescript dist-tags.latest
```

- [ ] **Step 2: 若 Next 跨大版號,先查官方 upgrade guide**

用 context7 查 `next.js` 的 upgrading 文件(或 `npx @next/codemod@latest upgrade latest`)。特別確認:`next dev --turbopack` flag 是否仍需要、`next lint` 移除與否(本 plan 已改用 eslint CLI,不受影響)、App Router breaking changes。

- [ ] **Step 3: 升級**

```bash
pnpm -F web add next@latest react@latest react-dom@latest
pnpm -F web add -D typescript@latest @types/node@latest @types/react@latest @types/react-dom@latest @next/eslint-plugin-next@latest
```

- [ ] **Step 4: 驗證**

```bash
pnpm -F web lint && pnpm -F web check-types && pnpm -F web build
```

Expected: 全綠。若 build 失敗,依 Step 2 的 upgrade guide 修正(常見:config 選項改名),修到綠為止。

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): upgrade next/react/typescript to latest stable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 建 `@rfjs/web-core`(registry + zod schema,TDD)

**Files:**
- Create: `packages/web-core/package.json`、`packages/web-core/tsconfig.json`、`packages/web-core/eslint.config.js`、`packages/web-core/vitest.config.mts`
- Create: `packages/web-core/src/index.ts`、`packages/web-core/src/registry/schemas.ts`、`packages/web-core/src/registry/tools.ts`、`packages/web-core/src/registry/packages.ts`
- Test: `packages/web-core/src/registry/registry.spec.ts`

設計決策:型別由 zod schema `z.infer` 衍生(單一事實來源,形狀與 spec §7 的 `ToolDefinition`/`PackageDefinition` 一致)。直接 export TS source(private 包,由 Next `transpilePackages` 編譯),不設 build step。URL codec(lz-string)屬 Phase 2,本 task 不做。

- [ ] **Step 1: 建包骨架**

`packages/web-core/package.json`:

```json
{
  "name": "@rfjs/web-core",
  "version": "0.0.0",
  "description": "Tool/package registry, schemas, and fixtures for the rfjs web app",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "vitest": "vitest",
    "vitest:run": "vitest run"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "typescript": "5.7.3",
    "typescript-eslint": "^8.24.0",
    "vitest": "^3.2.3"
  }
}
```

(安裝時用 `pnpm view zod dist-tags.latest` 確認 v4 為最新穩定,否則退回 `^3`。)

`packages/web-core/tsconfig.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "vitest.config.mts"]
}
```

`packages/web-core/eslint.config.js`:

```js
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
];
```

`packages/web-core/vitest.config.mts`(repo 慣例,比照 data-filter):

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['src/**/*.test.(ts|js)', 'src/**/*.spec.(ts|js)'],
    globals: true,
    reporters: ['verbose'],
  },
});
```

```bash
pnpm install
```

- [ ] **Step 2: 寫失敗測試** — `packages/web-core/src/registry/registry.spec.ts`

```ts
import { describe, expect, it } from 'vitest';

import { packageRegistry } from './packages';
import { packageDefinitionSchema, toolDefinitionSchema } from './schemas';
import { toolRegistry } from './tools';

describe('toolRegistry', () => {
  it('every entry matches the tool schema', () => {
    for (const tool of toolRegistry) {
      expect(() => toolDefinitionSchema.parse(tool)).not.toThrow();
    }
  });

  it('ids and hrefs are unique', () => {
    const ids = toolRegistry.map((t) => t.id);
    const hrefs = toolRegistry.map((t) => t.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('relatedPackages all exist in packageRegistry', () => {
    const names = new Set(packageRegistry.map((p) => p.name));
    for (const tool of toolRegistry) {
      for (const pkg of tool.relatedPackages ?? []) {
        expect(names, `${tool.id} → ${pkg}`).toContain(pkg);
      }
    }
  });
});

describe('packageRegistry', () => {
  it('every entry matches the package schema', () => {
    for (const pkg of packageRegistry) {
      expect(() => packageDefinitionSchema.parse(pkg)).not.toThrow();
    }
  });

  it('names are unique', () => {
    const names = packageRegistry.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('relatedTools all exist in toolRegistry', () => {
    const ids = new Set(toolRegistry.map((t) => t.id));
    for (const pkg of packageRegistry) {
      for (const toolId of pkg.relatedTools ?? []) {
        expect(ids, `${pkg.name} → ${toolId}`).toContain(toolId);
      }
    }
  });
});
```

- [ ] **Step 3: 跑測試,確認失敗**

```bash
pnpm -F @rfjs/web-core vitest:run
```

Expected: FAIL — `Cannot find module './packages'`(或同類解析錯誤)。

- [ ] **Step 4: 實作 schemas** — `packages/web-core/src/registry/schemas.ts`

```ts
import { z } from 'zod';

export const toolCategorySchema = z.enum([
  'format',
  'transform',
  'query',
  'filter',
  'inspect',
  'generator',
]);

export const registryStatusSchema = z.enum(['ready', 'preview', 'planned']);

export const toolDefinitionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: toolCategorySchema,
  href: z.string().startsWith('/'),
  status: registryStatusSchema,
  relatedPackages: z.array(z.string().startsWith('@rfjs/')).optional(),
  tags: z.array(z.string()).optional(),
});

export const packageDefinitionSchema = z.object({
  name: z.string().startsWith('@rfjs/'),
  description: z.string().min(1),
  status: registryStatusSchema,
  href: z.string().startsWith('/'),
  npm: z.string().url().optional(),
  github: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  relatedTools: z.array(z.string()).optional(),
});

export type ToolCategory = z.infer<typeof toolCategorySchema>;
export type RegistryStatus = z.infer<typeof registryStatusSchema>;
export type ToolDefinition = z.infer<typeof toolDefinitionSchema>;
export type PackageDefinition = z.infer<typeof packageDefinitionSchema>;
```

- [ ] **Step 5: 實作 tool registry** — `packages/web-core/src/registry/tools.ts`

所有工具 Phase 1 一律 `status: 'planned'`(頁面還不存在;之後哪個 phase 出貨哪個頁,才翻成 `ready`/`preview`,避免首頁 featured 連到 404)。

```ts
import type { ToolDefinition } from './schemas';

export const toolRegistry: ToolDefinition[] = [
  {
    id: 'object-flatten',
    title: 'Object Flatten / Unflatten',
    description: 'Flatten nested objects to dot-path keys and back.',
    category: 'transform',
    href: '/tools/object-flatten',
    status: 'planned',
    relatedPackages: ['@rfjs/object-utils'],
    tags: ['object', 'flatten'],
  },
  {
    id: 'type-converter',
    title: 'Data Type Converter',
    description: 'Convert values between string, number, boolean, and date.',
    category: 'transform',
    href: '/tools/type-converter',
    status: 'planned',
    relatedPackages: ['@rfjs/data-transform'],
    tags: ['convert', 'types'],
  },
  {
    id: 'data-filter-tester',
    title: 'JSONPath Filter Tester',
    description: 'Run @rfjs/data-filter conditions against sample data live.',
    category: 'filter',
    href: '/tools/data-filter-tester',
    status: 'planned',
    relatedPackages: ['@rfjs/data-filter'],
    tags: ['jsonpath', 'filter'],
  },
  {
    id: 'jwt-decoder',
    title: 'JWT Decoder',
    description: 'Decode JWT header and payload locally — nothing leaves your browser.',
    category: 'inspect',
    href: '/tools/jwt-decoder',
    status: 'planned',
    relatedPackages: ['@rfjs/jwt'],
    tags: ['jwt', 'decode'],
  },
  {
    id: 'jsonb-query-generator',
    title: 'Filter → JSONB SQL',
    description: 'Generate PostgreSQL JSONB queries from filter metadata.',
    category: 'query',
    href: '/tools/jsonb-query-generator',
    status: 'planned',
    relatedPackages: ['@rfjs/jsonb-query'],
    tags: ['postgres', 'jsonb', 'sql'],
  },
  {
    id: 'mongo-query-generator',
    title: 'Filter → Mongo Query',
    description: 'Generate MongoDB queries from filter metadata.',
    category: 'query',
    href: '/tools/mongo-query-generator',
    status: 'planned',
    relatedPackages: ['@rfjs/mongo-query'],
    tags: ['mongodb', 'query'],
  },
  {
    id: 'data-filter-builder',
    title: 'Data Filter Builder',
    description: 'Compose nested filter conditions visually and export them.',
    category: 'filter',
    href: '/playground/data-filter-builder',
    status: 'planned',
    relatedPackages: ['@rfjs/data-filter'],
    tags: ['builder', 'playground'],
  },
  {
    id: 'object-transformer',
    title: 'Object Transformer',
    description: 'Interactive object transformation playground.',
    category: 'transform',
    href: '/playground/object-transformer',
    status: 'planned',
    relatedPackages: ['@rfjs/object-utils', '@rfjs/data-transform'],
    tags: ['object', 'playground'],
  },
];
```

- [ ] **Step 6: 實作 package registry** — `packages/web-core/src/registry/packages.ts`

(描述取自各包 `package.json` 的 `description`;npm 已發佈者標 `ready`,`jsonb-query` 被 hold 標 `preview`,`data-label` 未發佈標 `preview`。)

```ts
import type { PackageDefinition } from './schemas';

const GITHUB = 'https://github.com/royfw/rfjs';

const npmUrl = (name: string) => `https://www.npmjs.com/package/${name}`;

export const packageRegistry: PackageDefinition[] = [
  {
    name: '@rfjs/data-filter',
    description: 'Filter in-memory data with JSONPath-addressed conditions.',
    status: 'ready',
    href: '/packages/data-filter',
    npm: npmUrl('@rfjs/data-filter'),
    github: GITHUB,
    tags: ['filter', 'jsonpath'],
    relatedTools: ['data-filter-tester', 'data-filter-builder'],
  },
  {
    name: '@rfjs/data-transform',
    description: 'Data type transformation utilities (string/number/boolean/date).',
    status: 'ready',
    href: '/packages/data-transform',
    npm: npmUrl('@rfjs/data-transform'),
    github: GITHUB,
    tags: ['transform', 'types'],
    relatedTools: ['type-converter', 'object-transformer'],
  },
  {
    name: '@rfjs/data-label',
    description: 'Compose display label strings from data paths, value maps, and templates.',
    status: 'preview',
    href: '/packages/data-label',
    github: GITHUB,
    tags: ['label', 'template'],
  },
  {
    name: '@rfjs/jsonb-query',
    description: 'PostgreSQL JSONB query builder from filter metadata.',
    status: 'preview',
    href: '/packages/jsonb-query',
    github: GITHUB,
    tags: ['postgres', 'jsonb'],
    relatedTools: ['jsonb-query-generator'],
  },
  {
    name: '@rfjs/jwt',
    description: 'JWT sign/verify/decode helper.',
    status: 'ready',
    href: '/packages/jwt',
    npm: npmUrl('@rfjs/jwt'),
    github: GITHUB,
    tags: ['jwt', 'auth'],
    relatedTools: ['jwt-decoder'],
  },
  {
    name: '@rfjs/mongo-query',
    description: 'MongoDB query builder from filter metadata.',
    status: 'ready',
    href: '/packages/mongo-query',
    npm: npmUrl('@rfjs/mongo-query'),
    github: GITHUB,
    tags: ['mongodb', 'query'],
    relatedTools: ['mongo-query-generator'],
  },
  {
    name: '@rfjs/object-utils',
    description: 'Object manipulation utilities (flatten, paths, merge).',
    status: 'ready',
    href: '/packages/object-utils',
    npm: npmUrl('@rfjs/object-utils'),
    github: GITHUB,
    tags: ['object', 'flatten'],
    relatedTools: ['object-flatten', 'object-transformer'],
  },
  {
    name: '@rfjs/pg-toolkit',
    description: 'PostgreSQL admin utilities (seed history, DB/schema creation).',
    status: 'ready',
    href: '/packages/pg-toolkit',
    npm: npmUrl('@rfjs/pg-toolkit'),
    github: GITHUB,
    tags: ['postgres', 'admin'],
  },
  {
    name: '@rfjs/retry',
    description: 'Retry helper with configurable delay.',
    status: 'ready',
    href: '/packages/retry',
    npm: npmUrl('@rfjs/retry'),
    github: GITHUB,
    tags: ['retry', 'async'],
  },
  {
    name: '@rfjs/tpl-toolkit',
    description: 'Shared config factories for rfjs project templates.',
    status: 'ready',
    href: '/packages/tpl-toolkit',
    npm: npmUrl('@rfjs/tpl-toolkit'),
    github: GITHUB,
    tags: ['config', 'templates'],
  },
];
```

- [ ] **Step 7: 出口** — `packages/web-core/src/index.ts`

```ts
export {
  packageDefinitionSchema,
  registryStatusSchema,
  toolCategorySchema,
  toolDefinitionSchema,
} from './registry/schemas';
export type {
  PackageDefinition,
  RegistryStatus,
  ToolCategory,
  ToolDefinition,
} from './registry/schemas';
export { packageRegistry } from './registry/packages';
export { toolRegistry } from './registry/tools';
```

- [ ] **Step 8: 跑測試,確認通過**

```bash
pnpm -F @rfjs/web-core vitest:run
```

Expected: PASS — 6 tests。

- [ ] **Step 9: lint + 型別 + turbo test 接線確認**

```bash
pnpm -F @rfjs/web-core lint && pnpm -F @rfjs/web-core check-types
pnpm turbo run test --filter=@rfjs/web-core
```

Expected: 全綠;turbo 能解析到 `test` script。

- [ ] **Step 10: Commit**

```bash
git add packages/web-core pnpm-lock.yaml
git commit -m "feat(web-core): add tool/package registry with zod schemas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 建 `@rfjs/web-ui` 殼 + Tailwind v4 接線

**Files:**
- Create: `packages/web-ui/package.json`、`packages/web-ui/tsconfig.json`、`packages/web-ui/eslint.config.js`、`packages/web-ui/src/styles/globals.css`、`packages/web-ui/src/lib/utils.ts`
- Modify: `apps/web/package.json`(加依賴)、`apps/web/postcss.config.mjs`(新建)、`apps/web/app/globals.css`、`apps/web/next.config.js`、`apps/web/app/page.tsx`

先用 context7 確認 Tailwind v4 在 monorepo + Next 的安裝細節(`@tailwindcss/postcss`、`@source` 路徑語意)再動工。

- [ ] **Step 1: 建包骨架**

`packages/web-ui/package.json`:

```json
{
  "name": "@rfjs/web-ui",
  "version": "0.0.0",
  "description": "Design tokens, Tailwind preset, and shared UI components for the rfjs web app",
  "type": "module",
  "private": true,
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts"
  },
  "scripts": {
    "lint": "eslint . --max-warnings 0",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.20.0",
    "@types/react": "19.0.8",
    "@types/react-dom": "19.0.3",
    "eslint": "^9.20.1",
    "eslint-config-prettier": "^10.0.1",
    "eslint-plugin-react": "^7.37.4",
    "eslint-plugin-react-hooks": "^5.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "5.7.3",
    "typescript-eslint": "^8.24.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

(版本以 Task 2 升級後的實際版本對齊:`@types/react` 等與 `apps/web` 一致;`tailwind-merge` 用 `pnpm view tailwind-merge dist-tags.latest` 確認。)

`packages/web-ui/tsconfig.json`:

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

`packages/web-ui/eslint.config.js`:

```js
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    plugins: { "react-hooks": pluginReactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
  eslintConfigPrettier,
];
```

- [ ] **Step 2: 樣式入口 + 暫定 tokens** — `packages/web-ui/src/styles/globals.css`

```css
@import "tailwindcss";

/* 讓 Tailwind 掃描 web-ui 自己的元件(路徑相對於本 CSS 檔) */
@source "../components";

@theme {
  /* 暫定 tokens — Task 7 設計計畫定稿後替換為正式色票/字體 */
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
}
```

- [ ] **Step 3: cn() 工具** — `packages/web-ui/src/lib/utils.ts`

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: web 端接線**

```bash
pnpm -F web add -D tailwindcss @tailwindcss/postcss postcss
pnpm -F web add @rfjs/web-ui@workspace:* @rfjs/web-core@workspace:*
```

`apps/web/postcss.config.mjs`(新建):

```js
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

`apps/web/app/globals.css` 改為:

```css
@import "@rfjs/web-ui/globals.css";
```

`apps/web/next.config.js` 改為:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rfjs/web-ui", "@rfjs/web-core"],
};

export default nextConfig;
```

- [ ] **Step 5: 用 Tailwind class 改寫 `apps/web/app/page.tsx` 作 smoke test**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="font-mono text-3xl font-bold">rfjs</h1>
      <p className="text-sm">
        RoyFW&apos;s TypeScript utility toolkit — site under construction.
      </p>
    </main>
  );
}
```

- [ ] **Step 6: 安裝 + 驗證(含視覺確認)**

```bash
pnpm install
pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types
pnpm -F web build
```

Expected: 全綠。再 `pnpm -F web dev` 開 `http://localhost:3000`,確認置中排版與 mono 字體生效(= Tailwind pipeline 通了),確認完即關。

- [ ] **Step 7: Commit**

```bash
git add packages/web-ui apps/web pnpm-lock.yaml
git commit -m "feat(web-ui): add tailwind v4 entry and wire web app styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: shadcn/ui 初始化(元件裝進 `@rfjs/web-ui`)

**Files:**
- Create: `apps/web/components.json`、`packages/web-ui/components.json`
- Create(由 CLI 產生): `packages/web-ui/src/components/button.tsx`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: 用 context7 查 shadcn monorepo 文件**,確認 CLI 目前的 monorepo 流程與 `components.json` 欄位(以下內容為基準,與文件不符時以文件為準並回報差異)。

- [ ] **Step 2: 建兩份 `components.json`**

`apps/web/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "../../packages/web-ui/src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "hooks": "@/hooks",
    "lib": "@/lib",
    "utils": "@rfjs/web-ui/lib/utils",
    "ui": "@rfjs/web-ui/components"
  }
}
```

`packages/web-ui/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@rfjs/web-ui/components",
    "hooks": "@rfjs/web-ui/hooks",
    "lib": "@rfjs/web-ui/lib",
    "utils": "@rfjs/web-ui/lib/utils",
    "ui": "@rfjs/web-ui/components"
  }
}
```

- [ ] **Step 3: 加第一個元件(smoke)**

```bash
cd apps/web && pnpm dlx shadcn@latest add button && cd ../..
```

Expected: 元件落在 `packages/web-ui/src/components/button.tsx`(CLI 依 `ui` alias 路由到 workspace 包)。若 CLI 把檔案放錯位置,手動移到 `packages/web-ui/src/components/` 並修 import。確認 CLI 新增的依賴(`class-variance-authority`、`lucide-react`、`@radix-ui/*`)裝進 `@rfjs/web-ui` 而非 web;裝錯則 `pnpm -F web remove <pkg> && pnpm -F @rfjs/web-ui add <pkg>`。

- [ ] **Step 4: 在頁面使用 Button 驗證 import 鏈**

`apps/web/app/page.tsx`:

```tsx
import { Button } from "@rfjs/web-ui/components/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="font-mono text-3xl font-bold">rfjs</h1>
      <p className="text-sm">
        RoyFW&apos;s TypeScript utility toolkit — site under construction.
      </p>
      <Button variant="outline">It works</Button>
    </main>
  );
}
```

- [ ] **Step 5: 驗證**

```bash
pnpm -F @rfjs/web-ui lint && pnpm -F @rfjs/web-ui check-types
pnpm -F web lint && pnpm -F web check-types && pnpm -F web build
```

Expected: 全綠;build 的 `/` 路由仍為 Static。

- [ ] **Step 6: Commit**

```bash
git add apps/web packages/web-ui pnpm-lock.yaml
git commit -m "feat(web-ui): init shadcn with components routed to @rfjs/web-ui

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: monorepo 全綠驗證 + 文件

**Files:**
- Modify: `apps/web/README.md`、`README.md`(root)

- [ ] **Step 1: 全 repo 驗證**

```bash
pnpm turbo run lint check-types test build
```

Expected: 全綠(既有 packages 不受影響)。任何紅燈都要修復或回報,不得帶病通過。

- [ ] **Step 2: 改寫 `apps/web/README.md`**

```markdown
# web — rfjs web playground

Package showcase, interactive playgrounds, and developer data tools for the
`@rfjs/*` ecosystem. Not a blog or docs site (that's royfw.dev).

## Stack

Next.js App Router · TypeScript strict · Tailwind CSS v4 · shadcn/ui
(components live in `@rfjs/web-ui`) · registry data in `@rfjs/web-core`.

## Develop

pnpm -F web dev          # http://localhost:3000
pnpm -F web build
pnpm -F web lint
pnpm -F web check-types

## Add a tool / package to the site

Edit the registries in `packages/web-core/src/registry/` (`tools.ts`,
`packages.ts`). Schemas in `schemas.ts` validate entries;
`pnpm -F @rfjs/web-core test` checks cross-references. Homepage, sidebar,
tools index, and sitemap are all driven by these registries.
```

- [ ] **Step 3: root `README.md` 加一行**(在專案介紹段落):

```markdown
`apps/web` is the rfjs web playground and developer tools site.
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/README.md README.md
git commit -m "docs(web): document web playground positioning and registry workflow

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 設計計畫定稿(stop gate — 需用戶確認)

**Files:**
- Create: `docs/superpowers/specs/2026-06-11-web-design-plan.md`

執行此 task 時調用 `frontend-design:frontend-design` skill 輔助。以下為提案基準,寫進設計文件供用戶定稿;用戶若有意見,改文件不改程式(tokens 在 Phase 2 落地時才進 `@theme`)。

- [ ] **Step 1: 寫設計計畫文件**,內容必須包含:

**概念:**「輸入 → 輸出」的轉換動態是整站的 signature;色彩系統取材自 JSON syntax highlighting(key/string/number 各有專色),讓「資料」本身成為視覺語言。避免 AI 預設審美(米白+serif+赤陶、近黑+螢光綠)。

**提案色票(具名 hex,深色優先):**

| Token | Hex | 用途 |
|---|---|---|
| `ink` | `#10141A` | 主背景(深石墨,非純黑) |
| `surface` | `#1A2029` | 卡片/面板 |
| `fg` | `#E6EAF0` | 主文字 |
| `key` | `#B392F0` | JSON key 紫 — 主要互動色 |
| `string` | `#4EC9B0` | JSON string 青 — 成功/輸出 |
| `number` | `#FFB000` | JSON number 琥珀 — 強調/CTA |
| `danger` | `#F47067` | 錯誤 |

**字體配對:** IBM Plex Sans(display + body)+ IBM Plex Mono(code/輸出)— 同家族、資料工具氣質;經 `next/font` 載入。

**Signature 元素:** 工具頁輸入/輸出面板之間的「transform arrow」— 輸出更新時的單次微動畫(респects `prefers-reduced-motion`),其餘動效克制。

**版型概念:** desktop 左 sidebar + header;工具頁 `lg` 以上 40/60 左右分欄、以下上下堆疊;卡片牆 1→2→3 欄。

**底線:** 鍵盤焦點可見、`prefers-reduced-motion`、深色模式優先 + 淺色模式。

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-11-web-design-plan.md
git commit -m "docs(web): add design plan for web playground

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: 停 — 輸出 Phase 1 摘要,等用戶確認設計計畫與 Phase 2 開工**。摘要需含:刪了什麼、新增的包與路由、registry 位置、哪些指令全綠、設計提案要點、Phase 2 預告(首頁 + object-flatten 垂直切片)。

---

## Self-Review 紀錄

- **Spec coverage(Phase 1 範圍)**:盤點現況 ✓(plan 頭部)、清空範本 ✓(Task 1)、升級依賴 ✓(Task 2)、Tailwind+shadcn 進共用 UI 包 ✓(Task 4/5)、web-core 殼與 registry 型別 ✓(Task 3)、設計計畫定稿 ✓(Task 7)。三個 Turbo 原生包的移除(用戶追加需求)✓(Task 1)。`@rfjs/` 前綴(用戶追加需求)✓(Task 3/4)。
- **超出 Phase 1 而刻意不做**:nuqs/RHF/Zustand/CodeMirror/lz-string、route 鋪開、PreviewDeviceTabs、sitemap/OG — 屬 Phase 2/3 計劃。
- **Placeholder scan**:無 TBD;唯二的「依文件為準」步驟(Task 2 Step 2、Task 5 Step 1)是版本查證動作,附了基準內容與回報要求。
- **型別一致性**:`toolRegistry`/`packageRegistry`/`toolDefinitionSchema`/`packageDefinitionSchema`/`cn` 命名在 Task 3/4/5 間一致;registry 資料通過自身 schema 規則(href 以 `/` 開頭、name 以 `@rfjs/` 開頭、cross-ref 雙向存在)。
