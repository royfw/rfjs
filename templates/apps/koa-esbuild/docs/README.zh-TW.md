# koa-esbuild 文檔

一個使用 esbuild 構建的生產級 Koa 應用模板,適合建立高效能 REST API、微服務和網路服務。

## 概述

本模板提供了一個完整的基礎架構,用於建立基於 TypeScript 的網路應用,使用:

- **Koa** - 輕量且靈活的 Node.js 網路框架
- **esbuild** - 極快的 JavaScript 打包和建置工具
- **routing-controllers** - 基於裝飾器的路由,自動生成 OpenAPI
- **tsyringe** - 依賴注入容器
- **Vitest** - 現代化測試框架

## 功能特性

### 核心功能

- ⚡ **極速開發體驗**
  - esbuild 提供 10-100 倍更快的建置速度
  - 使用 nodemon 熱重載
  - 並行執行 TypeScript 型別檢查

- 🎯 **基於裝飾器的路由**
  - 使用 routing-controllers 的清晰控制器語法
  - 自動請求驗證
  - 內建錯誤處理

- 📚 **自動生成文檔**
  - Swagger UI 於 `/docs`
  - OpenAPI 3.0 規範
  - 從 TypeScript 型別自動生成模式

- 💉 **依賴注入**
  - 使用 tsyringe 的 IoC 容器
  - 簡易的服務管理
  - 可測試的架構

- 🧪 **完整測試支援**
  - 使用 Vitest 進行單元測試
  - 使用 supertest 進行 E2E 測試
  - 覆蓋率報告
  - UI 測試執行器

- 🔍 **程式碼品質**
  - 支援 TypeScript 的 ESLint
  - Prettier 程式碼格式化
  - 使用 husky 的 Git hooks
  - 使用 Commitizen 的傳統式提交

## 快速開始

### 前置需求

- Node.js 18 或更高版本
- pnpm 10.24.0 或更高版本

### 安裝

```bash
# 複製或克隆模板
cd koa-esbuild

# 安裝依賴
pnpm install
```

### 開發

```bash
# 啟動開發伺服器並自動重載
pnpm dev

# 伺服器將在 http://localhost:3000 啟動
# Swagger UI 可於 http://localhost:3000/docs 存取
```

### 建置

```bash
# 生產環境建置
pnpm build

# 輸出將在 ./dist 目錄
```

### 生產環境執行

```bash
# 建置後
pnpm start

# 或直接使用 Node
node dist/main.js
```

## 專案結構

```
koa-esbuild/
├── src/
│   ├── main.ts                    # 應用程式進入點
│   ├── koaApp.ts                 # Koa 應用設定
│   ├── server.ts                 # 伺服器配置
│   ├── configs.ts                # 環境配置
│   ├── ioc/                      # 依賴注入
│   │   └── iocAdapter.ts         # IoC 容器適配器
│   └── utils/                    # 工具模組
│       ├── index.ts
│       ├── demo/                 # 示範工具
│       └── time/                 # 時間工具
├── test/                         # E2E 測試檔案
├── docs/                         # VitePress 文檔
├── esbuild.build.mjs            # 生產建置配置
├── esbuild.dev.mjs              # 開發建置配置
└── vitest.config.mts            # Vitest 配置
```

## 配置

### 環境變數

根據 `.env.example` 建立 `.env.local` 檔案:

```env
# 伺服器
PORT=3000
NODE_ENV=local

# 加入你的自訂環境變數
```

### TypeScript 配置

模板包含多個 tsconfig 檔案:

- `tsconfig.json` - 基礎配置
- `tsconfig.app.json` - 應用程式程式碼
- `tsconfig.build.json` - 建置配置
- `tsconfig.spec.json` - 測試配置

## 建立控制器

使用 routing-controllers 裝飾器建立清晰的 API:

```typescript
import { JsonController, Get, Post, Body } from 'routing-controllers';
import { injectable } from 'tsyringe';

@injectable()
@JsonController('/api/users')
export class UserController {
  @Get()
  async getAll() {
    return { users: [] };
  }

  @Post()
  async create(@Body() user: CreateUserDto) {
    return { user };
  }
}
```

## 依賴注入

使用 tsyringe 註冊和注入服務:

```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private userRepo: UserRepository
  ) {}
  
  async findAll() {
    return this.userRepo.find();
  }
}
```

## 測試

### 單元測試

```bash
# 執行測試
pnpm test

# 監視模式
pnpm vitest

# UI 模式
pnpm vitest:ui

# 覆蓋率
pnpm vitest:run --coverage
```

### E2E 測試

```bash
# 執行 E2E 測試
pnpm test:e2e

# 使用 UI
pnpm vitest:e2e:ui
```

E2E 測試範例:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

describe('API E2E', () => {
  beforeAll(async () => {
    // 設定
  });

  it('GET /health 應該回傳 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
});
```

## 建置配置

### 開發建置 (esbuild.dev.mjs)

- 啟用監視模式
- 包含 source maps
- 快速重建
- Nodemon 整合

### 生產建置 (esbuild.build.mjs)

- 最佳化打包
- Tree shaking
- 壓縮
- 無 source maps

## 開發工作流程

### 可用指令

```bash
# 開發
pnpm dev                  # esbuild 監視 + 型別檢查 + 自動重載
pnpm dev:esbuild         # 僅 esbuild 監視
pnpm start               # 執行已建置的應用

# 建置
pnpm build               # 使用 esbuild 生產建置
pnpm build:tsc           # TypeScript 編譯器建置
pnpm clean               # 清理 dist 目錄

# 測試
pnpm test                # 執行單元測試
pnpm test:e2e            # 執行 E2E 測試
pnpm vitest              # 監視模式
pnpm vitest:ui           # UI 測試執行器
pnpm vitest:e2e          # E2E 監視模式
pnpm vitest:e2e:ui       # E2E UI 執行器

# 程式碼品質
pnpm lint                # 執行 ESLint
pnpm lint:fix            # 修復 ESLint 問題
pnpm typecheck           # 型別檢查不輸出
pnpm typecheck:watch     # 監視型別檢查

# Git 與發布
pnpm commit              # Commitizen 提交
pnpm release             # 使用 standard-version 建立發布

# 文檔
pnpm docs:dev            # 啟動 VitePress 開發伺服器
pnpm docs:build          # 建置文檔
pnpm docs:preview        # 預覽已建置的文檔
```

### Git 工作流程

1. 修改你的程式碼
2. 暫存變更: `git add .`
3. 使用 Commitizen 提交: `pnpm commit`
4. 推送變更

模板包含:
- Pre-commit hooks (lint-staged)
- 提交訊息檢查
- 提交前自動測試

## 中介軟體

Koa 使用串聯式中介軟體系統:

```typescript
import Koa from 'koa';
import bodyParser from '@koa/bodyparser';
import cors from '@koa/cors';
import logger from 'koa-logger';

const app = new Koa();

// 中介軟體堆疊
app.use(logger());
app.use(cors());
app.use(bodyParser());

// 錯誤處理中介軟體
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message };
  }
});
```

## OpenAPI/Swagger

於 `http://localhost:3000/docs` 存取 Swagger UI 以:
- 檢視所有 API 端點
- 互動式測試端點
- 查看請求/回應模式
- 下載 OpenAPI 規範

## 日誌記錄

模板包含 Winston 用於結構化日誌:

```typescript
import logger from './logger';

logger.info('應用程式已啟動');
logger.error('發生錯誤', { error });
logger.debug('除錯資訊', { data });
```

## 最佳實踐

1. **專案組織**
   - 保持控制器精簡,將邏輯移至服務
   - 使用依賴注入以提高可測試性
   - 按功能/模組組織

2. **錯誤處理**
   - 使用自訂錯誤類別
   - 集中式錯誤處理中介軟體
   - 適當的 HTTP 狀態碼

3. **驗證**
   - 使用 class-validator 裝飾器
   - 在控制器層級驗證
   - 回傳有意義的錯誤訊息

4. **測試**
   - 隨程式碼編寫測試
   - 業務邏輯追求高覆蓋率
   - 為關鍵流程使用 E2E 測試

5. **型別安全**
   - 在 tsconfig 中啟用嚴格模式
   - 避免 `any` 型別
   - 為資料結構使用介面

## 技術棧

- **執行環境**: Node.js 18+
- **框架**: Koa 3.0+
- **語言**: TypeScript 5.7+
- **建置工具**: esbuild 0.25+
- **測試**: Vitest 3.2+
- **驗證**: class-validator 0.14+
- **DI 容器**: tsyringe 4.10+
- **文檔**: VitePress 1.6+
- **套件管理器**: pnpm 10.24+

## 故障排除

### 常見問題

**連接埠已被使用**
```bash
# 在 .env.local 中更改 PORT
PORT=3001
```

**型別檢查錯誤**
```bash
# 單獨執行型別檢查
pnpm typecheck
```

**建置失敗**
```bash
# 清理並重建
pnpm clean
pnpm build
```

## 其他資源

- [Koa 文檔](https://koajs.com/)
- [esbuild 文檔](https://esbuild.github.io/)
- [routing-controllers](https://github.com/typestack/routing-controllers)
- [tsyringe](https://github.com/microsoft/tsyringe)
- [Vitest 文檔](https://vitest.dev/)

## 授權

ISC

---

**屬於** [start-ts-templates](https://github.com/royfw/start-ts-templates)