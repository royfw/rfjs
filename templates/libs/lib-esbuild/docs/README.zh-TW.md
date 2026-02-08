# lib-esbuild - 繁體中文文檔

## 📑 目錄

- [專案概述](#-專案概述)
- [快速開始](#-快速開始)
- [核心功能](#-核心功能)
- [專案結構](#-專案結構)
- [開發指南](#-開發指南)
- [建構配置](#-建構配置)
- [測試](#-測試)
- [發布套件](#-發布套件)
- [最佳實踐](#-最佳實踐)

## 🎯 專案概述

**lib-esbuild** 是一個生產級的 TypeScript 函式庫範本,專為 npm 套件開發優化。它利用 esbuild 的卓越速度提供近乎即時的建構,同時保持完整的 TypeScript 型別安全和現代化工具鏈。

### 為什麼選擇 lib-esbuild?

- **極速建構** - esbuild 比傳統打包工具快 10-100 倍
- **雙格式輸出** - 同時輸出 ESM 和 CJS 格式以獲得最大相容性
- **型別安全** - 完整的 TypeScript 支援與打包型別宣告
- **開發體驗** - 熱重載、完整測試、品質工具
- **生產就緒** - 優化建構、tree-shaking、source maps

### 適用場景

- NPM 套件和函式庫
- 共享元件庫
- 工具函式集合
- SDK 開發
- 公司內部套件

## 🚀 快速開始

### 環境需求

- Node.js 18+
- pnpm 10.24+

### 安裝步驟

```bash
# 從範本建立
degit royfw/start-ts-templates/templates/lib-esbuild my-library
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

### 1. esbuild 整合

超快速的 JavaScript/TypeScript 打包工具:

- **速度** - 比 Webpack/Rollup 快 10-100 倍
- **ESM & CJS** - 雙格式輸出
- **Tree Shaking** - 自動移除死程式碼
- **Source Maps** - 用於除錯建構後的程式碼
- **平台中立** - 可在 Node.js 和瀏覽器中運作

### 2. TypeScript 配置

完整的 TypeScript 設定:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "strict": true
  }
}
```

### 3. 雙套件支援

支援兩種模組系統:

```json
{
  "main": "dist/index.js",      // CJS 進入點
  "module": "dist/index.mjs",   // ESM 進入點
  "types": "dist/index.d.ts"    // 型別宣告
}
```

### 4. 開發工具

完整的開發環境:

- **Vitest** - 快速單元測試
- **ESLint** - 程式碼檢查
- **Prettier** - 程式碼格式化
- **Husky** - Git hooks
- **lint-staged** - 提交前檢查

## 📁 專案結構

```
lib-esbuild/
├── src/
│   ├── index.ts                    # 函式庫進入點
│   └── utils/
│       └── demo/
│           ├── getDemoValue.ts    # 範例工具
│           └── getExDemoValue.ts  # 擴充工具
├── test/
│   └── app.e2e-spec.ts           # E2E 測試
├── scripts/
│   ├── copyPackageJsonPlugin.ts  # 建構腳本
│   └── dtsBundlePlugin.ts        # 型別宣告打包器
├── dist/                          # 建構輸出
│   ├── index.js                  # CJS 打包檔
│   ├── index.mjs                 # ESM 打包檔
│   └── index.d.ts                # 型別宣告
├── esbuild.build.ts              # 生產建構配置
├── esbuild.dev.ts                # 開發建構配置
└── package.json
```

## 🛠️ 開發指南

### 可用指令

```bash
# 開發
pnpm dev                # 監聽模式 + 型別檢查
pnpm dev:esbuild        # 僅 esbuild 監聽

# 建構
pnpm build              # 生產建構
pnpm build:esbuild      # esbuild 建構
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
// src/utils/math/add.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

2. **從 index 匯出**:

```typescript
// src/utils/math/index.ts
export * from './add';

// src/utils/index.ts
export * from './math';

// src/index.ts
export * from './utils';
```

3. **新增測試**:

```typescript
// src/utils/math/add.spec.ts
import { describe, it, expect } from 'vitest';
import { add } from './add';

describe('add', () => {
  it('應該將兩個數字相加', () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

## 🔧 建構配置

### esbuild 配置

```typescript
// esbuild.build.ts
const sharedConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'neutral',
  sourcemap: true,
  external: [...dependencies, ...peerDependencies],
  tsconfig: './tsconfig.build.json',
  plugins: [esbuildPluginTsc()]
};

// ESM 輸出
await esbuild.build({
  ...sharedConfig,
  outfile: 'dist/index.mjs',
  format: 'esm'
});

// CJS 輸出
await esbuild.build({
  ...sharedConfig,
  outfile: 'dist/index.js',
  format: 'cjs'
});
```

### 型別宣告打包

使用 `dts-bundle-generator` 建立單一 `.d.ts` 檔案:

```typescript
// scripts/dtsBundlePlugin.ts
export function dtsBundlePlugin() {
  const entries = [
    {
      filePath: './src/index.ts',
      outFile: './dist/index.d.ts',
      output: {
        noBanner: true
      }
    }
  ];
  
  generateDtsBundle(entries);
}
```

### 外部依賴

依賴項會自動標記為外部:

```typescript
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const dependencies = Object.keys(pkg.dependencies || {});
const peerDependencies = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];
```

## 🧪 測試

### 單元測試

```typescript
// src/utils/demo/getDemoValue.spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from './getDemoValue';

describe('getDemoValue', () => {
  it('應該返回 demo 值', () => {
    const result = getDemoValue();
    expect(result).toBe('demo');
  });
});
```

### E2E 測試

```typescript
// test/app.e2e-spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from '@/utils';

describe('Library E2E', () => {
  it('應該匯出工具函式', () => {
    expect(getDemoValue).toBeDefined();
    expect(getDemoValue()).toBe('demo');
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

2. **建構和測試**:

```bash
pnpm build
pnpm test
```

3. **版本管理**:

```bash
# 使用 standard-version
pnpm release

# 指定版本
pnpm release -- --release-as 1.0.0

# 預演
pnpm release -- --dry-run
```

### NPM 發布

```bash
# 登入 npm
npm login

# 發布公開套件
npm publish --access public

# 發布 scoped 套件
npm publish
```

### 套件檔案

使用 `.npmignore` 或 `package.json` 的 files 欄位控制發布內容:

```json
{
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

## 🎯 最佳實踐

### 1. 模組匯出

使用具名匯出以獲得更好的 tree-shaking:

```typescript
// ✅ 好 - 具名匯出
export function myFunction() { }
export class MyClass { }

// ❌ 避免 - 預設匯出
export default { myFunction, MyClass };
```

### 2. 型別定義

提供完整的型別:

```typescript
// ✅ 好 - 明確型別
export function calculate(a: number, b: number): number {
  return a + b;
}

// ❌ 避免 - 隱式 any
export function calculate(a, b) {
  return a + b;
}
```

### 3. 副作用

標記無副作用的程式碼:

```json
{
  "sideEffects": false
}
```

### 4. Peer 依賴

對框架函式庫使用 peer dependencies:

```json
{
  "peerDependencies": {
    "react": ">=16.8.0"
  }
}
```

## 📊 效能提示

- 保持打包大小小(使用 `esbuild --metafile` 分析)
- 使用 tree-shaking 友善的模式
- 避免循環依賴
- 將框架依賴標記為外部
- 啟用 source maps 以便除錯

## 🔒 安全性

- 保持依賴項更新
- 定期使用 `npm audit`
- 檢查依賴項授權
- 避免發布機密資訊
- 正確使用 `.npmignore`

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