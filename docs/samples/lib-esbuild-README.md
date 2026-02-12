# lib-esbuild

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.24.0-orange.svg)](https://pnpm.io/)

## 📖 簡介

**lib-esbuild** 是一個使用 [esbuild](https://esbuild.github.io/) 構建的現代化 TypeScript 函式庫模板。它提供極速的構建效能、雙格式輸出(CJS + ESM),以及完整的型別定義生成,讓您能夠快速開發並發布高品質的 npm 套件。

## ✨ 特性

- ⚡ **極速構建** - esbuild 提供毫秒級的編譯速度
- 📦 **雙格式輸出** - 同時支援 CommonJS (CJS) 和 ES Modules (ESM)
- 🎯 **完整型別定義** - 自動生成 `.d.ts` 型別宣告檔案
- 🌳 **Tree-shaking 友善** - 優化的 bundle 配置支援按需引入
- 🧪 **Vitest 測試** - 快速的單元測試和 E2E 測試框架
- 📝 **程式碼品質** - ESLint + Prettier + 自動化格式化
- 🔄 **Watch 模式** - 開發時自動重建
- 📚 **VitePress 文檔** - 內建文檔網站支援
- 🪝 **Git Hooks** - Husky + lint-staged 確保程式碼品質
- 🚀 **發布就緒** - 完整的 npm 發布配置

## 🛠️ 技術棧

- **Runtime**: Node.js ≥18
- **Language**: TypeScript 5.7.3
- **Build Tool**: esbuild 0.25.1
- **Type Generation**: dts-bundle-generator 9.5.1
- **Testing**: Vitest 3.2.3
- **Linting**: ESLint 9.20.1 + typescript-eslint 8.24.0
- **Formatting**: Prettier 3.5.1
- **Documentation**: VitePress 1.6.3
- **Package Manager**: pnpm 10.24.0

## 🚀 快速開始

### 前置需求

- **Node.js**: v18 或更高版本
- **pnpm**: v10.24.0 或更高版本

```bash
# 檢查版本
node --version
pnpm --version

# 安裝 pnpm (如果需要)
npm install -g pnpm@10.24.0
```

### 安裝

```bash
# 安裝依賴
pnpm install
```

### 開發

啟動開發模式 (watch 自動重建):

```bash
pnpm dev
```

### 構建

構建生產版本:

```bash
# 構建函式庫 (CJS + ESM + 型別定義)
pnpm build

# 輸出檔案:
# - dist/index.js (CommonJS)
# - dist/index.mjs (ES Module)
# - dist/index.d.ts (TypeScript 定義)
```

### 測試

```bash
# 運行單元測試
pnpm test

# Watch 模式測試
pnpm vitest

# 使用 UI 模式
pnpm vitest:ui

# 帶覆蓋率
pnpm vitest:run --coverage
```

## 📜 可用指令

### 開發指令

| 指令 | 說明 |
|------|------|
| `pnpm dev` | 啟動 watch 模式 (構建 + 型別檢查) |
| `pnpm dev:esbuild` | 僅 esbuild watch 模式 |
| `pnpm typecheck` | 執行 TypeScript 型別檢查 |
| `pnpm typecheck:watch` | 型別檢查 watch 模式 |

### 構建指令

| 指令 | 說明 |
|------|------|
| `pnpm build` | 生產構建 (CJS + ESM + 型別定義) |
| `pnpm build:esbuild` | 使用 esbuild 構建 |
| `pnpm clean` | 清理 dist/ 和 types/ 目錄 |
| `pnpm clean:dist` | 僅清理 dist/ |
| `pnpm clean:types` | 僅清理 types/ |

### 測試指令

| 指令 | 說明 |
|------|------|
| `pnpm test` | 運行所有測試 |
| `pnpm vitest` | Vitest watch 模式 |
| `pnpm vitest:ui` | Vitest UI 模式 |
| `pnpm vitest:run` | 運行一次測試 |

### 程式碼品質指令

| 指令 | 說明 |
|------|------|
| `pnpm lint` | 檢查程式碼風格 |
| `pnpm lint:fix` | 自動修復程式碼風格問題 |

### 文檔指令

| 指令 | 說明 |
|------|------|
| `pnpm docs:dev` | 啟動文檔開發伺服器 |
| `pnpm docs:build` | 構建文檔網站 |
| `pnpm docs:preview` | 預覽構建後的文檔 |

### 版本管理指令

| 指令 | 說明 |
|------|------|
| `pnpm commit` | 使用 Commitizen 提交 |
| `pnpm release` | 自動版本發布 |

## 📚 詳細文檔

查看完整的開發指南和 API 文檔:

- [英文文檔](docs/README.md)
- [繁體中文文檔](docs/README.zh-TW.md)

## 🏗️ 專案結構

```
lib-esbuild/
├── src/                    # 原始碼
│   ├── index.ts           # 函式庫入口
│   └── utils/             # 工具函式
│       └── demo/          # 示範模組
├── dist/                  # 構建輸出 (gitignored)
│   ├── index.js          # CommonJS bundle
│   ├── index.mjs         # ESM bundle
│   └── index.d.ts        # 型別定義
├── types/                 # 型別檔案 (gitignored)
├── docs/                  # VitePress 文檔
├── esbuild.build.ts       # 構建配置
├── esbuild.dev.ts         # 開發配置
├── tsconfig.json          # TypeScript 配置
└── package.json           # 套件配置
```

## 📦 Package.json 設定

確保您的 `package.json` 包含以下關鍵欄位:

```json
{
  "name": "your-library-name",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ]
}
```

## 🔧 使用範例

安裝您的函式庫後:

```typescript
// ESM
import { getDemoValue } from 'your-library-name';

const value = getDemoValue();
console.log(value); // 'demo'

// CommonJS
const { getDemoValue } = require('your-library-name');

const value = getDemoValue();
console.log(value); // 'demo'
```

## 🚀 發布到 npm

```bash
# 1. 構建函式庫
pnpm build

# 2. 測試構建產物
node -e "console.log(require('./dist/index.js'))"

# 3. 發布版本
pnpm release

# 4. 發布到 npm
npm publish
```

## 🤝 貢獻

歡迎貢獻!請遵循以下步驟:

1. Fork 本專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`pnpm commit`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

提交訊息請遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範。

## 📄 授權

本專案採用 ISC 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

---

由 [start-ts-templates](https://github.com/royfw/start-ts-templates) 建立