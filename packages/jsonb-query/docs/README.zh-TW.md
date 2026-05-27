# lib-tsdown - 繁體中文文檔

## 📑 目錄

- [專案概述](#-專案概述)
- [快速開始](#-快速開始)
- [核心功能](#-核心功能)
- [專案結構](#-專案結構)
- [開發指南](#-開發指南)
- [tsdown 配置](#-tsdown-配置)
- [測試](#-測試)
- [發布套件](#-發布套件)
- [最佳實踐](#-最佳實踐)

## 🎯 專案概述

**lib-tsdown** 是一個現代化的 TypeScript 函式庫範本,使用 tsdown 這個零配置打包工具,結合了 esbuild 的速度與 Rollup 生態系統的強大功能。專為想要快速建構而不需複雜配置的開發者設計。

### 為什麼選擇 lib-tsdown?

- **零配置** - 使用智慧預設值立即運作
- **極速建構** - 使用 Oxc 提供極快的編譯速度
- **現代化技術棧** - 基於最新的 TypeScript 和工具鏈
- **隔離宣告** - 使用 Oxc 快速生成型別
- **開發者友善** - 最少設定,最大生產力

### 適用場景

- NPM 套件和函式庫
- 工具函式集合
- 共享元件庫
- TypeScript SDK
- 公司內部套件

## 🚀 快速開始

### 環境需求

- Node.js 18+
- pnpm 10.24+

### 安裝步驟

```bash
# 從範本建立
degit royfw/start-ts-templates/templates/lib-tsdown my-library
cd my-library

# 安裝依賴
pnpm install

# 開始開發
pnpm dev
```

### 第一次建構

```bash
# 建構函式庫
pnpm build

# 輸出檔案:
# dist/index.js       - CommonJS 打包檔
# dist/index.mjs      - ES Module 打包檔
# dist/index.d.ts     - TypeScript 型別宣告
```

## ✨ 核心功能

### 1. tsdown 建構系統

零配置的 TypeScript 打包工具:

- **無需配置** - 開箱即用
- **快速編譯** - 由 Oxc 驅動
- **雙格式輸出** - ESM 和 CJS 輸出
- **Tree Shaking** - 自動優化
- **型別生成** - 快速宣告打包

### 2. Oxc 整合

現代化的 JavaScript 工具鏈:

- **快速解析** - 基於 Rust 的解析器
- **型別生成** - 支援隔離宣告
- **壓縮** - 內建程式碼壓縮
- **Source Maps** - 完整的除錯支援

### 3. 簡單配置

只需最少的配置:

```typescript
// tsdown.config.ts
export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: { oxc: true }
});
```

### 4. 開發工作流程

完整的開發設定:

- **監聽模式** - 變更時自動重建
- **型別檢查** - 平行 TypeScript 驗證
- **品質工具** - ESLint、Prettier、Husky
- **測試** - Vitest 整合

## 📁 專案結構

```
lib-tsdown/
├── src/
│   ├── index.ts                    # 函式庫進入點
│   └── utils/
│       └── demo/
│           ├── getDemoValue.ts    # 範例工具
│           ├── getExDemoValue.ts  # 擴充工具
│           └── getExtraValue.ts   # 額外工具
├── dist/                          # 建構輸出
│   ├── index.js                  # CJS 打包檔
│   ├── index.mjs                 # ESM 打包檔
│   └── index.d.ts                # 型別宣告
├── tsdown.config.ts              # tsdown 配置
└── package.json
```

## 🛠️ 開發指南

### 可用指令

```bash
# 開發
pnpm dev                # 監聽模式 + 型別檢查
pnpm dev:tsdown         # 僅 tsdown 監聽

# 建構
pnpm build              # 生產建構
pnpm build:tsdown       # tsdown 建構
pnpm clean              # 清理建構產物

# 測試
pnpm test               # 執行測試
pnpm vitest             # 互動式測試模式
pnpm vitest:ui          # 測試 UI
pnpm vitest:e2e         # E2E 測試

# 程式碼品質
pnpm lint               # 程式碼檢查
pnpm lint:fix           # 修復檢查問題
pnpm typecheck          # 型別檢查
pnpm typecheck:watch    # 監聽型別檢查
```

### 新增新函式

1. **建立工具函式**:

```typescript
// src/utils/format/phone.ts
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}
```

2. **從 index 匯出**:

```typescript
// src/utils/format/index.ts
export * from './phone';

// src/utils/index.ts
export * from './format';

// src/index.ts
export * from './utils';
```

3. **新增測試**:

```typescript
// src/utils/format/phone.spec.ts
import { describe, it, expect } from 'vitest';
import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('應該格式化電話號碼', () => {
    expect(formatPhone('1234567890')).toBe('(123) 456-7890');
  });
});
```

## ⚙️ tsdown 配置

### 基本配置

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  // 進入點
  entry: 'src/index.ts',
  
  // 輸出目錄
  outDir: 'dist',
  
  // 輸出格式
  format: ['esm', 'cjs'],
  
  // 平台目標
  platform: 'neutral',
  
  // ES 目標
  target: 'es2023',
  
  // 啟用 tree shaking
  treeshake: true,
  
  // 啟用 source maps
  sourcemap: true,
  
  // 清理輸出目錄
  clean: true,
  
  // 使用 Oxc 生成型別宣告
  dts: {
    oxc: true
  }
});
```

### 外部依賴

```typescript
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const dependencies = Object.keys(pkg.dependencies || {});
const peerDependencies = Object.keys(pkg.peerDependencies || {});

export default defineConfig({
  external: [...dependencies, ...peerDependencies]
});
```

### 自訂插件

```typescript
import { defineConfig } from 'tsdown';
import { myCustomPlugin } from './plugins/custom';

export default defineConfig({
  plugins: [
    myCustomPlugin()
  ]
});
```

## 🧪 測試

### 單元測試

```typescript
// src/utils/demo/getDemoValue.spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from './getDemoValue';

describe('getDemoValue', () => {
  it('應該返回 demo 值', () => {
    expect(getDemoValue()).toBe('demo');
  });
});
```

### E2E 測試

```typescript
// test/app.e2e-spec.ts
import { describe, it, expect } from 'vitest';
import * as lib from '../src';

describe('Library E2E', () => {
  it('應該匯出所有工具函式', () => {
    expect(lib.getDemoValue).toBeDefined();
  });
});
```

### 覆蓋率

```bash
pnpm vitest -- --coverage
```

## 📦 發布套件

### 準備發布

1. **更新 package.json**:

```json
{
  "name": "@yourscope/library-name",
  "version": "1.0.0",
  "description": "您的函式庫描述",
  "author": "您的名字",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/library-name"
  }
}
```

2. **配置匯出**:

```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

3. **建構和測試**:

```bash
pnpm build
pnpm test
pnpm typecheck
```

### NPM 發布

```bash
# 登入 npm
npm login

# 發布
npm publish --access public
```

### 版本管理

```bash
# 使用 standard-version
pnpm release

# 指定版本
pnpm release -- --release-as 1.0.0

# 預演
pnpm release -- --dry-run
```

## 🎯 最佳實踐

### 1. 隔離宣告

啟用以獲得更快的型別生成:

```json
// tsconfig.json
{
  "compilerOptions": {
    "isolatedDeclarations": true
  }
}
```

### 2. 具名匯出

使用具名匯出以獲得更好的 tree-shaking:

```typescript
// ✅ 好
export function myFunction() { }
export class MyClass { }

// ❌ 避免
export default { myFunction, MyClass };
```

### 3. 副作用

標記無副作用的程式碼:

```json
{
  "sideEffects": false
}
```

### 4. 型別定義

提供完整的型別:

```typescript
// ✅ 好
export function calculate(a: number, b: number): number {
  return a + b;
}

// ❌ 避免
export function calculate(a, b) {
  return a + b;
}
```

## 📊 效能提示

- 啟用 Oxc 以獲得更快的建構
- 使用隔離宣告
- 保持打包大小小
- 避免循環依賴
- 將依賴項標記為外部

## 🔒 安全性

- 保持依賴項更新
- 定期執行 `npm audit`
- 檢查依賴項授權
- 正確使用 `.npmignore`
- 驗證已發布套件

## 🤝 貢獻

歡迎貢獻!請:
- 為新功能新增測試
- 遵循現有程式碼風格
- 更新文檔
- 建立有意義的提交

## 📄 授權

ISC

---

**使用 [start-ts-templates](https://github.com/royfw/start-ts-templates) 建立**