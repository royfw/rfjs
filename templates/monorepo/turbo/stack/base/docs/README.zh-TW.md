# Turborepo Monorepo - 繁體中文文檔

## 📑 目錄

- [專案概述](#-專案概述)
- [快速開始](#-快速開始)
- [Monorepo 結構](#-monorepo-結構)
- [核心功能](#-核心功能)
- [開發指南](#-開發指南)
- [Turborepo 配置](#-turborepo-配置)
- [新增套件](#-新增套件)
- [工作區管理](#-工作區管理)
- [測試](#-測試)
- [部署](#-部署)
- [最佳實踐](#-最佳實踐)

## 🎯 專案概述

**Turborepo Monorepo** 是一個由 Turborepo 驅動的生產級 monorepo 範本,專為建構可擴展的多專案應用程式而設計。它包含一個 Next.js 應用程式和用於 UI 元件、ESLint 配置和 TypeScript 配置的共享套件。

### 為什麼選擇 Turborepo?

- **極速** - 智慧快取和平行執行
- **增量建構** - 只重建變更的部分
- **遠端快取** - 在團隊間共享快取
- **任務管道** - 定義任務依賴關係
- **工作區管理** - 無縫的套件依賴管理

### 適用場景

- 多應用程式專案
- 元件庫與文檔
- 微服務架構
- 共享工具和配置
- 設計系統

## 🚀 快速開始

### 環境需求

- Node.js 18+
- pnpm 10.24+

### 安裝步驟

```bash
# 從範本建立
degit royfw/start-ts-templates/templates/turbo my-monorepo
cd my-monorepo

# 安裝所有依賴
pnpm install

# 啟動所有應用程式的開發模式
pnpm dev
```

### 第一次建構

```bash
# 建構所有應用程式和套件
pnpm build

# 執行特定工作區
pnpm --filter web dev
```

## 📁 Monorepo 結構

```
turbo/
├── apps/                             # 應用程式
│   └── web/                         # Next.js 應用程式
│       ├── app/                     # Next.js App Router
│       ├── public/                  # 靜態資源
│       └── package.json             # 應用程式依賴
├── packages/                         # 共享套件
│   ├── ui/                          # UI 元件庫
│   │   ├── src/                    # 元件
│   │   └── package.json            # 套件配置
│   ├── eslint-config/              # ESLint 配置
│   │   ├── base.js                 # 基礎配置
│   │   ├── next.js                 # Next.js 配置
│   │   └── react-internal.js       # React 配置
│   └── typescript-config/          # TypeScript 配置
│       ├── base.json               # 基礎配置
│       ├── nextjs.json             # Next.js 配置
│       └── react-library.json      # 函式庫配置
├── turbo.json                       # Turborepo 配置
├── pnpm-workspace.yaml             # 工作區定義
└── package.json                     # 根套件
```

## ✨ 核心功能

### 1. Turborepo 建構系統

高效能的 monorepo 工具:

- **任務快取** - 永遠不會重建相同的內容
- **平行執行** - 在工作區之間同時執行任務
- **任務管道** - 定義任務依賴關係
- **遠端快取** - 在團隊/CI 間共享快取
- **增量建構** - 只重建變更的套件

### 2. 工作區管理

PNPM 工作區用於依賴管理:

- **共享依賴** - 去重複的 node_modules
- **工作區協定** - 引用本地套件
- **快速安裝** - 內容定址儲存
- **嚴格模式** - 防止幽靈依賴

### 3. Next.js 整合

現代化 Web 應用程式:

- **App Router** - 最新的 Next.js 架構
- **Turbopack** - 更快的開發建構
- **React 19** - 最新的 React 功能
- **TypeScript** - 完整的型別安全

### 4. 共享套件

跨應用程式可重用的套件:

- **UI 元件** - 共享 React 元件
- **ESLint 配置** - 一致的程式碼風格
- **TypeScript 配置** - 共享型別配置

## 🛠️ 開發指南

### 可用指令

```bash
# 開發
pnpm dev                    # 在開發模式下執行所有應用程式
pnpm --filter web dev       # 執行特定應用程式

# 建構
pnpm build                  # 建構所有應用程式和套件
pnpm --filter web build     # 建構特定應用程式

# 測試
pnpm test                   # 執行所有測試
pnpm --filter ui test       # 測試特定套件

# 程式碼品質
pnpm lint                   # 檢查所有套件
pnpm typecheck              # 檢查整個 monorepo 的型別
pnpm format                 # 使用 Prettier 格式化程式碼
```

### 執行特定工作區

```bash
# 在特定工作區執行命令
pnpm --filter web dev
pnpm --filter @repo/ui build

# 在多個工作區執行
pnpm --filter "web" --filter "@repo/ui" dev
```

### 開發工作流程

1. **啟動開發伺服器**:
```bash
pnpm dev
```

2. **對應用程式或套件進行變更**

3. **查看熱重載** - 變更立即反映

4. **建構和測試**:
```bash
pnpm build
pnpm test
```

## ⚙️ Turborepo 配置

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^test"]
    }
  }
}
```

### 任務依賴

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // 先建構依賴
      "outputs": ["dist/**"]
    }
  }
}
```

### 快取

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],      // 快取這些輸出
      "inputs": ["src/**", "*.ts"] // 這些變更時使快取失效
    }
  }
}
```

## 📦 新增套件

### 建立新套件

1. **建立套件目錄**:
```bash
mkdir -p packages/my-package
cd packages/my-package
```

2. **初始化 package.json**:
```json
{
  "name": "@repo/my-package",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

3. **加入工作區**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 建立新應用程式

1. **建立應用程式目錄**:
```bash
mkdir -p apps/my-app
cd apps/my-app
```

2. **初始化 Next.js 應用程式**:
```bash
pnpm create next-app@latest .
```

3. **使用工作區套件**:
```json
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}
```

## 🔧 工作區管理

### 工作區協定

引用本地套件:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/eslint-config": "workspace:*"
  }
}
```

### 共享依賴

為特定工作區安裝依賴:

```bash
pnpm --filter web add react
```

為所有工作區安裝:

```bash
pnpm add -w typescript
```

### 工作區命令

```bash
# 列出所有工作區
pnpm -r list

# 在所有工作區執行命令
pnpm -r build

# 平行執行
pnpm -r --parallel dev
```

## 🧪 測試

### 單元測試

```typescript
// packages/ui/src/button.spec.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('應該渲染', () => {
    const { getByText } = render(<Button>點我</Button>);
    expect(getByText('點我')).toBeDefined();
  });
});
```

### E2E 測試

```typescript
// apps/web/tests/home.spec.ts
import { test, expect } from '@playwright/test';

test('首頁', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading')).toContain('歡迎');
});
```

## 🚀 部署

### Vercel 部署

Turborepo 為 Vercel 優化:

```bash
# Vercel 會自動偵測 turbo.json
vercel deploy
```

### Docker 部署

```dockerfile
FROM node:18-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm turbo build --filter=web

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### 遠端快取

為團隊啟用遠端快取:

```bash
# 連結到 Vercel
npx turbo login
npx turbo link
```

## 🎯 最佳實踐

### 1. 套件命名

```json
// ✅ 好 - 作用域命名
{
  "name": "@repo/ui",
  "name": "@repo/eslint-config"
}

// ❌ 避免 - 通用名稱
{
  "name": "ui",
  "name": "config"
}
```

### 2. 任務組織

```json
// ✅ 好 - 清晰的依賴關係
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}

// ❌ 避免 - 沒有依賴關係
{
  "tasks": {
    "build": {}
  }
}
```

### 3. 工作區依賴

```json
// ✅ 好 - 使用工作區協定
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}

// ❌ 避免 - 硬編碼版本
{
  "dependencies": {
    "@repo/ui": "0.0.0"
  }
}
```

### 4. 共享配置

```typescript
// ✅ 好 - 擴充共享配置
// apps/web/tsconfig.json
{
  "extends": "@repo/typescript-config/nextjs.json"
}

// ❌ 避免 - 重複配置
{
  "compilerOptions": { /* ... */ }
}
```

## 📊 效能提示

- 啟用遠端快取
- 有效使用任務管道
- 利用平行執行
- 快取建構輸出
- 使用增量建構

## 🔒 安全性

- 保持依賴項更新
- 使用工作區協定
- 定期稽核所有套件
- 實施存取控制
- 使用環境變數

## 🤝 貢獻

歡迎貢獻!請:
- 遵循工作區結構
- 為新功能新增測試
- 更新文檔
- 使用約定式提交

## 📄 授權

ISC

---

**使用 [start-ts-templates](https://github.com/royfw/start-ts-templates) 建立**