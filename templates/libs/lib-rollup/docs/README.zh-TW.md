# lib-rollup - 繁體中文文檔

## 📑 目錄

- [專案概述](#-專案概述)
- [快速開始](#-快速開始)
- [核心功能](#-核心功能)
- [專案結構](#-專案結構)
- [開發指南](#-開發指南)
- [Rollup 配置](#-rollup-配置)
- [插件生態系統](#-插件生態系統)
- [測試](#-測試)
- [發布套件](#-發布套件)
- [最佳實踐](#-最佳實踐)

## 🎯 專案概述

**lib-rollup** 是一個生產級的 TypeScript 函式庫範本,使用 Rollup 作為打包工具。Rollup 是 JavaScript 函式庫打包的事實標準,擅長建立優化的、可 tree-shake 的套件,能在不同模組系統中無縫運作。

### 為什麼選擇 lib-rollup?

- **業界標準** - 被 React、Vue、Three.js 等無數函式庫使用
- **最佳 Tree-Shaking** - 業界最佳的死程式碼移除
- **插件生態系統** - 數百個官方和社群插件
- **ESM 優先** - 現代化 ES 模組支援與 CJS 相容性
- **靈活配置** - 強大的配置選項支援複雜建構

### 適用場景

- NPM 套件和函式庫
- 框架插件和擴充功能
- UI 元件庫
- JavaScript SDK
- 共享工具套件

## 🚀 快速開始

### 環境需求

- Node.js 18+
- pnpm 10.24+

### 安裝步驟

```bash
# 從範本建立
degit royfw/start-ts-templates/templates/lib-rollup my-library
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

### 1. Rollup 建構系統

函式庫的業界標準打包工具:

- **Tree Shaking** - 進階的死程式碼移除
- **程式碼分割** - 自動區塊優化
- **插件系統** - 可擴充的建構流程
- **多種格式** - 支援 ESM、CJS、UMD、IIFE
- **Source Maps** - 完整的除錯支援

### 2. 內建官方插件

預先配置的必要 Rollup 插件:

- `@rollup/plugin-node-resolve` - 解析 node_modules
- `@rollup/plugin-commonjs` - 轉換 CJS 為 ESM
- `@rollup/plugin-json` - 匯入 JSON 檔案
- `@rollup/plugin-terser` - 程式碼壓縮
- `rollup-plugin-typescript2` - TypeScript 編譯
- `rollup-plugin-dts` - 型別宣告打包

### 3. TypeScript 整合

完整的 TypeScript 支援:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true
  }
}
```

### 4. 開發工作流程

完整的開發設定:

- **監聽模式** - 檔案變更自動重建
- **型別檢查** - 平行 TypeScript 檢查
- **熱重載** - 快速迭代週期
- **品質工具** - ESLint、Prettier、Husky

## 📁 專案結構

```
lib-rollup/
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
├── rollup.config.ts              # Rollup 配置
└── package.json
```

## 🛠️ 開發指南

### 可用指令

```bash
# 開發
pnpm dev                # 監聽模式 + 型別檢查
pnpm dev:rollup         # 僅 Rollup 監聽

# 建構
pnpm build              # 生產建構
pnpm build:rollup       # Rollup 建構
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
// src/utils/string/capitalize.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

2. **從 index 匯出**:

```typescript
// src/utils/string/index.ts
export * from './capitalize';

// src/utils/index.ts
export * from './string';

// src/index.ts
export * from './utils';
```

3. **新增測試**:

```typescript
// src/utils/string/capitalize.spec.ts
import { describe, it, expect } from 'vitest';
import { capitalize } from './capitalize';

describe('capitalize', () => {
  it('應該將首字母大寫', () => {
    expect(capitalize('hello')).toBe('Hello');
  });
});
```

## 🔧 Rollup 配置

### 基本配置

```typescript
// rollup.config.ts
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  // JavaScript 打包檔
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/index.mjs',
        format: 'esm',
        sourcemap: true
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.lib.json'
      }),
      terser()
    ],
    external: ['tslib']
  },
  // 型別宣告
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
```

### 外部依賴

標記依賴項為外部以避免打包:

```typescript
import pkg from './package.json';

export default {
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ]
};
```

### 輸出選項

多種輸出格式:

```typescript
output: [
  { file: 'dist/index.js', format: 'cjs' },      // CommonJS
  { file: 'dist/index.mjs', format: 'esm' },     // ES Module
  { file: 'dist/index.umd.js', format: 'umd' }   // UMD
]
```

## 🔌 插件生態系統

### 常用插件

**Node 解析:**
```typescript
import resolve from '@rollup/plugin-node-resolve';

plugins: [
  resolve({
    preferBuiltins: true,
    extensions: ['.ts', '.js']
  })
]
```

**CommonJS 轉換:**
```typescript
import commonjs from '@rollup/plugin-commonjs';

plugins: [
  commonjs({
    include: 'node_modules/**'
  })
]
```

**壓縮:**
```typescript
import terser from '@rollup/plugin-terser';

plugins: [
  terser({
    compress: {
      drop_console: true
    }
  })
]
```

**JSON 匯入:**
```typescript
import json from '@rollup/plugin-json';

plugins: [json()]
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
  },
  "keywords": ["library", "typescript", "rollup"]
}
```

2. **配置套件匯出**:

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

# 使用標籤
npm publish --tag beta
```

### 版本管理

使用 Commitizen:

```bash
# 進行變更
git add .
pnpm commit

# 發布版本
npx standard-version
git push --follow-tags
```

## 🎯 最佳實踐

### 1. 可 Tree-Shake 的匯出

使用具名匯出以獲得最佳 tree-shaking:

```typescript
// ✅ 好 - 可 tree-shake
export function add(a: number, b: number) { return a + b; }
export function subtract(a: number, b: number) { return a - b; }

// ❌ 避免 - 無法 tree-shake
export default {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b
};
```

### 2. 副作用管理

標記無副作用的套件:

```json
{
  "sideEffects": false
}
```

或指定有副作用的檔案:

```json
{
  "sideEffects": ["*.css", "src/polyfills.ts"]
}
```

### 3. Peer 依賴

對框架函式庫使用:

```json
{
  "peerDependencies": {
    "react": ">=16.8.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  }
}
```

### 4. 打包分析

分析打包大小:

```bash
# 使用 rollup-plugin-visualizer
pnpm add -D rollup-plugin-visualizer
```

```typescript
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({
    filename: 'bundle-analysis.html',
    open: true
  })
]
```

## 📊 效能提示

- 使用 `@rollup/plugin-terser` 進行壓縮
- 使用 ESM 輸出啟用 tree-shaking
- 正確標記外部依賴
- 避免循環依賴
- 對大型函式庫使用程式碼分割
- 生成 source maps 以便除錯

## 🔒 安全性

- 使用 `pnpm update` 保持依賴項更新
- 定期執行 `npm audit`
- 檢查依賴項授權
- 使用 `.npmignore` 排除敏感檔案
- 驗證已發布套件內容

## 🤝 貢獻

歡迎貢獻!請:
- 為新功能新增測試
- 遵循現有程式碼風格
- 更新文檔
- 建立有意義的提交訊息

## 📄 授權

ISC

---

**使用 [start-ts-templates](https://github.com/royfw/start-ts-templates) 建立**