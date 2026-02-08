# start-ts-templates 文檔

start-ts-templates 專案的完整文檔 - 一個生產級 TypeScript 專案模板集合。

## 目錄

- [概述](#概述)
- [快速開始](#快速開始)
- [模板目錄](#模板目錄)
- [架構](#架構)
- [使用指南](#使用指南)
- [開發](#開發)
- [貢獻](#貢獻)

## 概述

**start-ts-templates** 是一個精心策劃的 monorepo,包含 12 個專門的 TypeScript 模板,旨在加速開發工作流程。每個模板都代表其特定用例的最佳實踐,從網路應用程式到函式庫、CLI 工具和文檔網站。

### 理念

- **生產優先**: 每個模板都是生產就緒的,具有完整的工具鏈
- **最佳實踐**: 業界標準的配置和模式
- **開發體驗**: 快速建置、即時回饋、全面測試
- **靈活性**: 為你的需求選擇正確的工具
- **文檔**: 英文和繁體中文的詳盡文檔

### 包含內容

- 🎯 **4 個應用模板** - 各種框架和建置工具
- 📚 **3 個函式庫模板** - 針對不同需求的不同打包工具
- 🛠️ **1 個 CLI 模板** - 命令列工具腳手架
- 📝 **2 個文檔模板** - 客戶端和 SSG 選項
- 🏗️ **1 個 Monorepo 模板** - 使用 Turborepo 的全端架構

## 快速開始

### 前置需求

- **Node.js**: 18 或更高版本
- **pnpm**: 10.24.0 或更高版本 (由 preinstall 腳本強制執行)
- **Git**: 用於版本控制

### 安裝方式

#### 方式 1: 使用 start-ts-by CLI (推薦)

```bash
# 全域安裝
npm install -g start-ts-by

# 建立新專案
start-ts-by create my-project

# 或使用特定模板
start-ts-by create my-api --template fastify-esbuild

# 或使用 npx (無需安裝)
npx start-ts-by create my-app --template app-esbuild
```

#### 方式 2: 克隆並複製

```bash
# 克隆儲存庫
git clone https://github.com/royfw/start-ts-templates.git

# 導航至所需模板
cd start-ts-templates/templates/app-esbuild

# 移除 git 歷史
rm -rf .git

# 初始化新儲存庫
git init

# 安裝依賴
pnpm install
```

#### 方式 3: 下載模板

從 GitHub 下載特定模板:
```
https://github.com/royfw/start-ts-templates/tree/main/templates/{template-name}
```

### 快速啟動

```bash
# 安裝依賴
pnpm install

# 啟動開發
pnpm dev

# 執行測試
pnpm test

# 生產建置
pnpm build
```

## 模板目錄

### 應用模板

#### app-esbuild

**目的**: 通用 TypeScript 應用程式開發

**主要功能**:
- esbuild 提供 10-100 倍更快的建置速度
- 多種建置模式 (esbuild, tsx, tsc)
- Vitest 測試
- VitePress 文檔
- Docker 就緒

**適用於**:
- CLI 工具
- 後端服務
- Node.js 應用程式
- 快速原型開發

**技術棧**:
- 建置: esbuild 0.25+
- 測試: Vitest 3.2+
- 執行環境: Node.js 18+

[📖 文檔](../templates/app-esbuild/docs/README.zh-TW.md)

---

#### app-tsdown

**目的**: 最小打包體積的優化應用程式

**主要功能**:
- tsdown 現代打包
- 優化輸出
- Tree-shaking
- 快速建置

**適用於**:
- 生產應用程式
- 體積關鍵應用
- Serverless 函式

**技術棧**:
- 建置: tsdown
- 測試: Vitest 3.2+
- 執行環境: Node.js 18+

[📖 文檔](../templates/app-tsdown/docs/README.zh-TW.md)

---

#### fastify-esbuild

**目的**: 高效能 REST API 開發

**主要功能**:
- Fastify 5.6+ 框架
- 自動生成 Swagger 文檔
- 插件系統
- 請求驗證
- esbuild 快速建置

**適用於**:
- REST APIs
- 微服務
- 後端服務
- API 閘道

**技術棧**:
- 框架: Fastify 5.6+
- 建置: esbuild 0.25+
- 測試: Vitest 3.2+
- 文檔: Swagger/OpenAPI

[📖 文檔](../templates/fastify-esbuild/docs/README.zh-TW.md)

---

#### koa-esbuild

**目的**: 輕量級網路應用程式開發

**主要功能**:
- Koa 3.0+ 框架
- 基於裝飾器的路由 (routing-controllers)
- 依賴注入 (tsyringe)
- OpenAPI 文檔
- 基於中介軟體的架構

**適用於**:
- 網路應用程式
- REST APIs
- 靈活的中介軟體需求
- IoC 模式專案

**技術棧**:
- 框架: Koa 3.0+
- 建置: esbuild 0.25+
- DI: tsyringe 4.10+
- 測試: Vitest 3.2+

[📖 文檔](../templates/koa-esbuild/docs/README.zh-TW.md)

### 函式庫模板

#### lib-rollup

**目的**: 業界標準函式庫打包

**主要功能**:
- Rollup 提供最佳 tree-shaking
- 雙重輸出 (ESM + CJS)
- TypeScript 宣告
- 豐富的插件生態系統

**適用於**:
- npm 套件
- 共享函式庫
- 元件函式庫
- 框架插件

**輸出格式**:
- ESM (`.mjs`)
- CommonJS (`.js`)
- TypeScript 宣告 (`.d.ts`)

**技術棧**:
- 建置: Rollup 4.36+
- 測試: Vitest 3.2+

[📖 文檔](../templates/lib-rollup/docs/README.zh-TW.md)

---

#### lib-tsdown

**目的**: 快速建置的現代函式庫開發

**主要功能**:
- tsdown 優化打包
- 最小打包體積
- 快速建置時間
- ESM + CJS 輸出

**適用於**:
- 現代 npm 套件
- 工具函式庫
- 體積關鍵函式庫

**技術棧**:
- 建置: tsdown
- 測試: Vitest 3.2+

[📖 文檔](../templates/lib-tsdown/docs/README.zh-TW.md)

---

#### lib-rolldown

**目的**: 次世代函式庫打包

**主要功能**:
- Rolldown (Rollup + esbuild)
- 兩者優勢結合
- 高效能
- 現代輸出

**適用於**:
- 高效能函式庫
- 大型套件
- 框架開發

**技術棧**:
- 建置: Rolldown
- 測試: Vitest 3.2+

[📖 文檔](../templates/lib-rolldown/docs/README.zh-TW.md)

### CLI 模板

#### bin-tsdown

**目的**: 命令列工具開發

**主要功能**:
- 優化的 CLI 打包
- Commander.js 整合
- 跨平台支援
- 可執行輸出

**適用於**:
- CLI 工具
- 腳手架工具
- 建置工具
- 自動化腳本

**技術棧**:
- 建置: tsdown
- CLI: Commander.js
- 測試: Vitest 3.2+

[📖 文檔](../templates/bin-tsdown/docs/README.zh-TW.md)

### 文檔模板

#### docs-docsify

**目的**: 零建置文檔網站

**主要功能**:
- 客戶端渲染
- 無建置過程
- 即時部署
- 插件生態系統
- 全文搜尋

**適用於**:
- 快速文檔
- 簡單專案文檔
- GitHub Pages
- 靜態託管

**技術棧**:
- 框架: Docsify
- 可選建置: esbuild/Rollup
- 測試: Jest 29.7+

[📖 文檔](../templates/docs-docsify/docs/README.zh-TW.md)

---

#### docs-vitepress

**目的**: 強大的 SSG 文檔網站

**主要功能**:
- VitePress 1.6+ (Vue 驅動 SSG)
- 極速 HMR
- Markdown 中的 Vue 元件
- 內建搜尋
- SEO 最佳化

**適用於**:
- 技術文檔
- API 參考
- 元件函式庫
- 大型文檔網站

**技術棧**:
- 框架: VitePress 1.6+
- 建置: Vite (Rollup + esbuild)
- UI: Vue 3
- 測試: Vitest/Jest

[📖 文檔](../templates/docs-vitepress/docs/README.zh-TW.md)

### Monorepo 模板

#### turbo

**目的**: 全端 monorepo 開發

**主要功能**:
- Turborepo 建置快取
- Next.js 網路應用程式
- 共享套件
- 工作區管理
- 優化管道

**適用於**:
- 大型專案
- 多應用系統
- 微服務
- 設計系統

**技術棧**:
- 建置系統: Turborepo 2.6+
- 框架: Next.js
- 套件管理器: pnpm
- 測試: Vitest

[📖 文檔](../templates/turbo/docs/README.zh-TW.md)

## 架構

### 儲存庫結構

```
start-ts-templates/
├── .husky/                    # Git hooks
├── docs/                      # 儲存庫文檔
│   ├── README.md             # 英文版
│   └── README.zh-TW.md       # 繁體中文版
├── packages/                  # 共享套件
│   ├── eslint-config/        # 共享 ESLint 配置
│   ├── typescript-config/    # 共享 TypeScript 配置
│   └── ui/                   # 共享 UI 元件
├── templates/                 # 模板專案
│   ├── app-esbuild/
│   ├── app-tsdown/
│   ├── fastify-esbuild/
│   ├── koa-esbuild/
│   ├── lib-rollup/
│   ├── lib-tsdown/
│   ├── lib-rolldown/
│   ├── bin-tsdown/
│   ├── docs-docsify/
│   ├── docs-vitepress/
│   └── turbo/
├── package.json               # 根套件配置
├── pnpm-workspace.yaml       # pnpm 工作區配置
├── turbo.json                # Turborepo 配置
└── README.md                 # 儲存庫 README
```

### 通用模式

#### 檔案結構 (典型模板)

```
template-name/
├── src/                      # 原始碼
│   ├── index.ts             # 進入點
│   ├── configs.ts           # 配置
│   └── utils/               # 工具
├── test/                     # E2E 測試
├── docs/                     # 文檔
│   ├── README.md            # 英文文檔
│   └── README.zh-TW.md      # 繁體中文文檔
├── .env.example             # 環境變數範本
├── package.json             # 依賴 & 腳本
├── tsconfig.json            # TypeScript 配置
├── vitest.config.mts        # Vitest 配置
└── README.md                # 模板 README
```

#### 標準腳本

所有模板都包含:

```json
{
  "scripts": {
    "dev": "...",           // 開發模式
    "build": "...",         // 生產建置
    "test": "...",          // 執行測試
    "lint": "...",          // 檢查程式碼
    "typecheck": "...",     // 型別檢查
    "commit": "npx cz",     // 傳統式提交
    "release": "..."        // 版本升級
  }
}
```

## 使用指南

### 選擇正確的模板

#### 應用程式

- **簡單應用或 CLI**: `app-esbuild`
- **優化打包**: `app-tsdown`
- **REST API (效能)**: `fastify-esbuild`
- **REST API (靈活)**: `koa-esbuild`

#### 函式庫

- **標準 npm 套件**: `lib-rollup`
- **現代、輕量**: `lib-tsdown`
- **高效能**: `lib-rolldown`

#### CLI 工具

- **命令列工具**: `bin-tsdown`

#### 文檔

- **快速簡單**: `docs-docsify`
- **功能豐富**: `docs-vitepress`

#### Monorepos

- **多應用專案**: `turbo`

### 自訂

#### 新增依賴

```bash
# 新增生產依賴
pnpm add <package>

# 新增開發依賴
pnpm add -D <package>
```

#### 修改配置

常見配置檔案:
- `tsconfig.json` - TypeScript 配置
- `eslint.config.mjs` - ESLint 規則
- `.prettierrc` - Prettier 格式化
- `vitest.config.mts` - Vitest 設定

#### 環境變數

1. 複製 `.env.example` 至 `.env.local`
2. 更新值
3. 永遠不要提交 `.env.local`

### 測試

#### 單元測試

```bash
# 執行測試
pnpm test

# 監視模式
pnpm vitest

# 覆蓋率
pnpm vitest:run --coverage

# UI 模式
pnpm vitest:ui
```

#### E2E 測試

```bash
# 執行 E2E 測試
pnpm test:e2e

# E2E 使用 UI
pnpm vitest:e2e:ui
```

### 部署

#### 生產建置

```bash
# 清理建置
pnpm clean
pnpm build

# 輸出在 ./dist 或指定的輸出目錄
```

#### Docker 部署

許多模板包含 Dockerfile:

```bash
# 建置映像
docker build -t my-app .

# 執行容器
docker run -p 3000:3000 my-app
```

#### CI/CD

模板適用於:
- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI

GitHub Actions 範例:

```yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
```

## 開發

### 為模板做貢獻

#### 設定

```bash
# 克隆儲存庫
git clone https://github.com/royfw/start-ts-templates.git
cd start-ts-templates

# 安裝依賴
pnpm install

# 執行特定模板
cd templates/app-esbuild
pnpm dev
```

#### 進行變更

1. 建立功能分支
2. 進行變更
3. 徹底測試
4. 更新文檔
5. 使用 commitizen 提交: `pnpm commit`
6. 推送並建立 PR

#### 新增新模板

1. 在 `templates/` 中建立目錄
2. 設定標準結構
3. 新增具有標準腳本的 package.json
4. 建立文檔 (README + docs/)
5. 新增測試
6. 更新根 README
7. 更新此文檔

### Monorepo 指令

```bash
# 安裝所有依賴
pnpm install

# 在開發模式執行所有模板
pnpm dev

# 建置所有模板
pnpm build

# 測試所有模板
pnpm test

# 檢查所有程式碼
pnpm lint

# 型別檢查所有內容
pnpm typecheck

# 格式化所有程式碼
pnpm format
```

### Turborepo

儲存庫使用 Turborepo 用於:
- 並行任務執行
- 智慧快取
- 任務依賴
- 遠端快取 (可選)

配置在 `turbo.json`。

## 最佳實踐

### 程式碼風格

- 使用 TypeScript 嚴格模式
- 遵循 ESLint 規則
- 使用 Prettier 格式化
- 使用傳統式提交

### 測試

- 隨程式碼編寫測試
- 業務邏輯追求高覆蓋率
- 為關鍵路徑使用 E2E 測試
- 保持測試快速且隔離

### 文檔

- 新增功能時更新 README
- 保持 docs/ 同步
- 提供程式碼範例
- 記錄破壞性變更

### 版本控制

- 使用語意化版本
- 自動生成變更日誌
- 適當標記發布
- 記錄遷移路徑

## 故障排除

### 常見問題

**pnpm install 失敗**
```bash
# 清除快取並重新安裝
pnpm store prune
rm -rf node_modules
pnpm install
```

**建置錯誤**
```bash
# 清理並重建
pnpm clean
pnpm build
```

**型別錯誤**
```bash
# 執行型別檢查
pnpm typecheck
```

**連接埠衝突**
```bash
# 在 .env.local 中更改連接埠
PORT=3001
```

## 其他資源

- [TypeScript 文檔](https://www.typescriptlang.org/)
- [pnpm 文檔](https://pnpm.io/)
- [Turborepo 文檔](https://turbo.build/)
- [Vitest 文檔](https://vitest.dev/)
- [esbuild 文檔](https://esbuild.github.io/)

## 授權

ISC

## 支援

- [GitHub Issues](https://github.com/royfw/start-ts-templates/issues)
- [Discussions](https://github.com/royfw/start-ts-templates/discussions)

---

**維護者** [royfw](https://github.com/royfw)

For English version, see [README.md](./README.md)