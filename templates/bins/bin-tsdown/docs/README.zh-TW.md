# bin-tsdown - 繁體中文文檔

## 📑 目錄

- [專案概述](#-專案概述)
- [快速開始](#-快速開始)
- [CLI 使用](#-cli-使用)
- [核心功能](#-核心功能)
- [專案結構](#-專案結構)
- [開發指南](#-開發指南)
- [建構 CLI](#-建構-cli)
- [測試](#-測試)
- [發布套件](#-發布套件)
- [最佳實踐](#-最佳實踐)

## 🎯 專案概述

**bin-tsdown** 是一個生產級的 CLI 工具範本,使用 TypeScript 和現代化工具鏈建構。它結合了 Commander.js 用於命令處理和 Inquirer 用於互動式提示,為建構強大的命令列應用程式提供堅實的基礎。

### 為什麼選擇 bin-tsdown?

- **互動式** - 使用 Inquirer 提供豐富的提示
- **型別安全** - 完整的 TypeScript 支援
- **快速建構** - tsdown 提供快速編譯
- **使用者友善** - 直觀的命令結構
- **生產就緒** - 內建錯誤處理和驗證

### 適用場景

- 專案腳手架工具
- 檔案生成器
- 建構自動化工具
- DevOps 工具
- 配置管理 CLI

## 🚀 快速開始

### 環境需求

- Node.js 18+
- pnpm 10.24+

### 安裝步驟

```bash
# 從範本建立
degit royfw/start-ts-templates/templates/bin-tsdown my-cli
cd my-cli

# 安裝依賴
pnpm install

# 在開發環境中執行
pnpm tsx
```

### 第一次執行

```bash
# 執行 CLI
pnpm tsx create my-project

# 使用範本選項
pnpm tsx create my-project -t user/repo

# 互動模式(無參數)
pnpm tsx create
```

## 🎯 CLI 使用

### 基本命令

```bash
# 使用名稱建立
your-cli create <project-name>

# 使用範本選項建立
your-cli create <project-name> -t <template>

# 互動模式
your-cli create
```

### 命令選項

```bash
-t, --template <repo>    GitHub 範本 (例如: user/repo)
-h, --help               顯示說明資訊
```

### 範例

```bash
# 互動式建立專案
your-cli create

# 使用所有選項建立
your-cli create my-app -t username/template-repo

# 取得說明
your-cli --help
```

## ✨ 核心功能

### 1. Commander.js 整合

強大的命令列介面框架:

- **命令定義** - 清晰的命令結構
- **選項解析** - 自動參數處理
- **說明生成** - 自動產生說明文字
- **子命令** - 支援巢狀命令
- **版本管理** - 內建版本顯示

### 2. Inquirer 提示

互動式使用者輸入:

- **多種輸入類型** - 文字、列表、確認等
- **驗證** - 內建和自訂驗證器
- **條件提示** - 動態問題流程
- **預設值** - 合理的預設值
- **錯誤處理** - 優雅處理使用者中斷

### 3. 專案腳手架

基於範本的專案建立:

- **GitHub 整合** - 從 GitHub 倉庫複製
- **多個範本** - 支援各種專案類型
- **檔案複製** - 自動檔案分發
- **配置** - 基於 JSON 的範本配置

### 4. 型別安全

完整的 TypeScript 支援:

- **型別定義** - 完整的型別覆蓋
- **IntelliSense** - IDE 自動完成支援
- **編譯時檢查** - 及早發現錯誤
- **重構安全** - 自信地更改程式碼

## 📁 專案結構

```
bin-tsdown/
├── src/
│   ├── index.ts                    # CLI 進入點
│   └── libs/
│       ├── index.ts               # 函式庫匯出
│       └── create.ts              # 建立命令邏輯
├── scripts/
│   ├── copyPackageJsonPlugin.ts   # 建構插件
│   └── copyFilesPlugin.ts         # 檔案複製插件
├── dist/
│   └── bin/
│       └── index.js               # 編譯後的 CLI
├── templates.json                  # 範本定義
├── copyFiles.json                  # 要複製的檔案
└── tsdown.config.ts               # 建構配置
```

## 🛠️ 開發指南

### 可用指令

```bash
# 開發
pnpm dev                # 監聽模式 + 型別檢查
pnpm tsx                # 使用 tsx 執行(即時啟動)

# 建構
pnpm build              # 生產建構
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
```

### 新增新命令

1. **在 index.ts 定義命令**:

```typescript
// src/index.ts
program
  .command('init [name]')
  .description('初始化新專案')
  .option('-f, --force', '強制覆寫')
  .action(async (name, options) => {
    await initProject({ name, force: options.force });
  });
```

2. **實作命令邏輯**:

```typescript
// src/libs/init.ts
export async function initProject(options: {
  name?: string;
  force?: boolean;
}) {
  // 實作內容
}
```

3. **新增互動式提示**:

```typescript
import inquirer from 'inquirer';

const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'name',
    message: '專案名稱:',
    default: 'my-project'
  },
  {
    type: 'confirm',
    name: 'force',
    message: '覆寫現有檔案?',
    default: false
  }
]);
```

## 🎨 建構 CLI

### 命令結構

```typescript
// 基本命令
program
  .command('create <name>')
  .description('建立新專案')
  .action((name) => {
    console.log(`正在建立 ${name}`);
  });

// 帶選項的命令
program
  .command('build')
  .option('-w, --watch', '監聽模式')
  .option('-m, --minify', '壓縮輸出')
  .action((options) => {
    console.log('正在建構...', options);
  });
```

### 互動式提示

```typescript
// 文字輸入
const { name } = await inquirer.prompt([
  {
    type: 'input',
    name: 'name',
    message: '請輸入您的名字:'
  }
]);

// 列表選擇
const { framework } = await inquirer.prompt([
  {
    type: 'list',
    name: 'framework',
    message: '選擇框架:',
    choices: ['React', 'Vue', 'Angular']
  }
]);

// 確認
const { confirmed } = await inquirer.prompt([
  {
    type: 'confirm',
    name: 'confirmed',
    message: '您確定嗎?',
    default: false
  }
]);
```

### 錯誤處理

```typescript
try {
  await createProject({ name, template });
} catch (error) {
  if (error.name === 'ExitPromptError') {
    console.log('👋 操作已取消');
    process.exit(0);
  } else {
    console.error('❌ 錯誤:', error);
    process.exit(1);
  }
}
```

### 範本配置

```json
// templates.json
[
  {
    "name": "React App",
    "repo": "username/react-template"
  },
  {
    "name": "Node.js API",
    "repo": "username/node-template"
  }
]
```

## 🧪 測試

### 單元測試

```typescript
// src/libs/create.spec.ts
import { describe, it, expect } from 'vitest';
import { createProject } from './create';

describe('createProject', () => {
  it('應該建立專案目錄', async () => {
    await createProject({
      name: 'test-project',
      template: 'user/template'
    });
    // 斷言
  });
});
```

### E2E 測試

```typescript
// test/cli.e2e-spec.ts
import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI E2E', () => {
  it('應該顯示說明訊息', async () => {
    const { stdout } = await execAsync('node dist/bin/index.js --help');
    expect(stdout).toContain('Usage:');
  });
});
```

## 📦 發布套件

### 準備發布

1. **更新 package.json**:

```json
{
  "name": "@yourscope/cli-name",
  "version": "1.0.0",
  "description": "您的 CLI 描述",
  "bin": {
    "your-cli": "./dist/bin/index.js"
  },
  "files": [
    "dist",
    "templates.json"
  ],
  "keywords": ["cli", "tool", "typescript"]
}
```

2. **在建構檔案中新增 shebang**:

```typescript
// 確保 index.ts 以此開頭:
#!/usr/bin/env node
```

3. **建構和測試**:

```bash
pnpm build
pnpm test

# 本地測試
npm link
your-cli --help
```

### NPM 發布

```bash
# 登入 npm
npm login

# 發布
npm publish --access public

# 測試安裝
npx @yourscope/cli-name --help
```

### 全域安裝

使用者可以全域安裝:

```bash
# 全域安裝
npm install -g @yourscope/cli-name

# 在任何地方使用
your-cli create my-project
```

## 🎯 最佳實踐

### 1. 使用者體驗

```typescript
// ✅ 好 - 清楚的訊息
console.log('✅ 專案建立成功!');
console.log('📦 正在安裝依賴...');

// ❌ 避免 - 不清楚的輸出
console.log('完成');
```

### 2. 錯誤處理

```typescript
// ✅ 好 - 有幫助的錯誤訊息
if (!projectName) {
  console.error('❌ 錯誤: 需要專案名稱');
  console.log('💡 試試: your-cli create my-project');
  process.exit(1);
}

// ❌ 避免 - 通用錯誤
if (!projectName) {
  throw new Error('Invalid input');
}
```

### 3. 驗證

```typescript
// ✅ 好 - 及早驗證
const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'name',
    message: '專案名稱:',
    validate: (input) => {
      if (!/^[a-z0-9-]+$/.test(input)) {
        return '名稱只能包含小寫字母、數字和連字號';
      }
      return true;
    }
  }
]);
```

### 4. 說明文字

```typescript
// ✅ 好 - 描述性說明
program
  .command('create <name>')
  .description('從範本建立新專案')
  .option('-t, --template <repo>', 'GitHub 範本倉庫 (例如: user/repo)')
  .action(handler);
```

## 📊 效能提示

- 對大型依賴使用延遲載入
- 快取常存取的資料
- 最小化檔案 I/O 操作
- 對大檔案使用串流
- 提供進度指示器

## 🔒 安全性

- 驗證所有使用者輸入
- 清理檔案路徑
- 使用安全的依賴項
- 避免執行任意程式碼
- 保持依賴項更新

## 🤝 貢獻

歡迎貢獻!請:
- 為新命令新增測試
- 遵循現有程式碼風格
- 更新文檔
- 在本地測試 CLI

## 📄 授權

ISC

---

**使用 [start-ts-templates](https://github.com/royfw/start-ts-templates) 建立**