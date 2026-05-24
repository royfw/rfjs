# app-esbuild

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.24.0-orange.svg)](https://pnpm.io/)

## 📖 簡介

**app-esbuild** 是一個使用 [esbuild](https://esbuild.github.io/) 構建的現代化 TypeScript 應用程式模板。它提供了極速的構建效能、完整的開發工作流程,以及生產就緒的配置,讓您能夠快速啟動 Node.js 應用程式專案。

## ✨ 特性

- ⚡ **極速構建** - 使用 esbuild 實現毫秒級的構建速度
- 🔄 **熱重載開發** - 自動監測檔案變更並重新啟動應用程式
- 🎯 **TypeScript 嚴格模式** - 完整的型別安全保障
- 🧪 **Vitest 測試框架** - 快速的單元測試和 E2E 測試
- 📝 **程式碼品質控制** - ESLint + Prettier + 自動化格式化
- 🔧 **多種構建方式** - 支援 esbuild、tsx、tsc 三種構建工具
- 🐳 **Docker 支援** - 包含完整的 Docker 和 Turbo prune 配置
- 📚 **VitePress 文檔** - 內建文檔網站支援
- 🪝 **Git Hooks** - Husky + lint-staged 自動化程式碼檢查
- 📦 **環境變數管理** - dotenv-flow 多環境配置支援

## 🛠️ 技術棧

- **Runtime**: Node.js ≥18
- **Language**: TypeScript 5.7.3
- **Build Tool**: esbuild 0.25.2
- **Testing**: Vitest 3.2.3
- **Linting**: ESLint 9.20.1 + typescript-eslint 8.24.0
- **Formatting**: Prettier 3.5.1
- **Documentation**: VitePress 1.6.3
- **Package Manager**: pnpm 10.24.0

## 🚀 快速開始

### 前置需求

確保您的開發環境已安裝:

- **Node.js**: v18 或更高版本
- **pnpm**: v10.24.0 或更高版本

```bash
# 檢查 Node.js 版本
node --version

# 安裝 pnpm (如果尚未安裝)
npm install -g pnpm@10.24.0
```

### 安裝

```bash
# 安裝依賴
pnpm install

# 複製環境變數範本
cp .env.example .env.local
```

### 開發

啟動開發模式 (使用 esbuild + watch):

```bash
pnpm dev
```

其他開發模式:

```bash
# 使用 tsx watch 模式 (更快的啟動速度)
pnpm dev:tsx

# 使用 TypeScript compiler watch 模式
pnpm dev:tsc
```

### 構建

```bash
# 使用 esbuild 構建 (推薦)
pnpm build

# 使用 TypeScript compiler 構建
pnpm build:tsc
```

### 測試

```bash
# 運行單元測試
pnpm test

# 運行 E2E 測試
pnpm test:e2e

# 使用 UI 模式查看測試結果
pnpm vitest:ui
```

### 運行

```bash
# 運行構建後的應用程式
pnpm start
```

## 📜 可用指令

### 開發指令

| 指令 | 說明 |
|------|------|
| `pnpm dev` | 啟動開發模式 (esbuild watch + typecheck) |
| `pnpm dev:tsx` | 使用 tsx watch 模式開發 |
| `pnpm dev:esbuild` | 使用 esbuild watch 模式開發 |
| `pnpm dev:tsc` | 使用 tsc watch 模式開發 |
| `pnpm tsx` | 使用 tsx 直接運行源碼 |
| `pnpm tsx:watch` | tsx watch 模式 |

### 構建指令

| 指令 | 說明 |
|------|------|
| `pnpm build` | 生產環境構建 (esbuild) |
| `pnpm build:esbuild` | 使用 esbuild 構建 |
| `pnpm build:tsc` | 使用 TypeScript compiler 構建 |
| `pnpm clean` | 清理構建產物 |

### 測試指令

| 指令 | 說明 |
|------|------|
| `pnpm test` | 運行單元測試 |
| `pnpm test:e2e` | 運行 E2E 測試 |
| `pnpm vitest` | Vitest watch 模式 |
| `pnpm vitest:ui` | Vitest UI 模式 |

### 程式碼品質指令

| 指令 | 說明 |
|------|------|
| `pnpm lint` | 檢查程式碼風格 |
| `pnpm lint:fix` | 自動修復程式碼風格問題 |
| `pnpm typecheck` | 型別檢查 |
| `pnpm typecheck:watch` | 型別檢查 watch 模式 |

### 文檔指令

| 指令 | 說明 |
|------|------|
| `pnpm docs:dev` | 啟動文檔開發伺服器 |
| `pnpm docs:build` | 構建文檔網站 |
| `pnpm docs:preview` | 預覽構建後的文檔 |

### 版本管理指令

| 指令 | 說明 |
|------|------|
| `pnpm commit` | 使用 Commitizen 提交程式碼 |
| `pnpm release` | 自動版本發布和 CHANGELOG 生成 |

## 📚 詳細文檔

查看完整的技術文檔和最佳實踐指南:

- [英文文檔](docs/README.md)
- [繁體中文文檔](docs/README.zh-TW.md)

## 🏗️ 專案結構

```
app-esbuild/
├── src/                    # 源碼目錄
│   ├── main.ts            # 應用程式入口
│   ├── configs.ts         # 配置檔案
│   └── utils/             # 工具函式
├── test/                  # E2E 測試
├── docs/                  # VitePress 文檔
├── docker/                # Docker 配置檔案
├── scripts/               # 構建腳本
├── esbuild.build.ts       # esbuild 生產構建配置
├── esbuild.dev.ts         # esbuild 開發構建配置
├── tsconfig.json          # TypeScript 配置
├── vitest.config.mts      # Vitest 配置
└── package.json           # 專案配置
```

## 🤝 貢獻

歡迎貢獻! 請遵循以下步驟:

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