# fastify-esbuild - 繁體中文文檔

## 📑 目錄

- [專案概述](#-專案概述)
- [快速開始](#-快速開始)
- [核心功能](#-核心功能)
- [專案結構](#-專案結構)
- [開發指南](#-開發指南)
- [API 文檔](#-api-文檔)
- [測試](#-測試)
- [部署](#-部署)
- [配置說明](#-配置說明)

## 🎯 專案概述

**fastify-esbuild** 是一個生產級的 Fastify 應用程式範本,使用 esbuild 建構以獲得最佳效能。它結合了 Fastify 的速度與 esbuild 的超快編譯,用於建立高效能的 REST API 和微服務。

### 為什麼選擇 fastify-esbuild?

- **極致效能** - Fastify 是最快的 Node.js 框架之一
- **閃電建構** - esbuild 提供 10-100 倍的建構速度
- **自動文檔** - 內建 Swagger/OpenAPI 整合
- **生產就緒** - 已配置 Docker、測試和部署
- **型別安全** - 全面的 TypeScript 支援

### 適用場景

- REST API 和微服務
- Web/行動應用程式的後端服務
- API 閘道
- 即時資料處理
- 高效能網路服務

## 🚀 快速開始

### 環境需求

- Node.js 18+
- pnpm 10.24+

### 安裝步驟

```bash
# 複製或從範本建立
degit royfw/start-ts-templates/templates/fastify-esbuild my-api
cd my-api

# 安裝依賴
pnpm install

# 複製環境變數檔案
cp .env.example .env.local

# 啟動開發伺服器
pnpm dev
```

### 第一個 API 呼叫

```bash
# 健康檢查
curl http://localhost:3000/health

# 查看 API 文檔
open http://localhost:3000/docs
```

## ✨ 核心功能

### 1. Fastify 框架

高效能的 Web 框架,具有:

- **快速路由** - 優化的路由匹配
- **Schema 驗證** - 基於 JSON Schema 的驗證
- **插件系統** - 模組化架構
- **生命週期掛鉤** - 請求/回應攔截
- **內建日誌** - Pino 日誌記錄器

### 2. 自動生成文檔

在 `/docs` 存取 Swagger UI:

- 互動式 API 測試
- 請求/回應範例
- Schema 文檔
- 認證測試

### 3. 預配置插件

包含必要的 Fastify 插件:

- `@fastify/cors` - CORS 支援
- `@fastify/swagger` - OpenAPI 文檔
- `@fastify/swagger-ui` - Swagger UI
- `@fastify/sensible` - 合理的預設值
- `@fastify/multipart` - 檔案上傳

### 4. 模組化架構

清晰的關注點分離:

```
delivery/http/     # HTTP 路由模組
infrastructures/   # 核心基礎設施
helpers/          # 輔助函式
utils/            # 業務工具
```

## 📁 專案結構

```
fastify-esbuild/
├── src/
│   ├── main.ts                           # 進入點
│   ├── configs.ts                        # 配置
│   ├── delivery/http/                    # HTTP 層
│   │   ├── app/                         # 應用程式路由
│   │   │   ├── routes.ts               # 路由定義
│   │   │   ├── module.ts               # 路由模組
│   │   │   └── handlers/               # 請求處理器
│   │   └── health/                      # 健康檢查路由
│   ├── infrastructures/                  # 核心設定
│   │   ├── fastify/                     # Fastify 配置
│   │   │   ├── initialize-app.ts       # 應用程式初始化
│   │   │   └── registers/              # 插件註冊
│   │   └── server/                      # 伺服器管理
│   └── utils/                           # 工具函式
├── test/                                 # 測試
├── docs/                                 # 文檔
└── docker/                               # Docker 配置
```

## 🛠️ 開發指南

### 可用指令

```bash
# 開發
pnpm dev              # esbuild 監聽 + 重載
pnpm dev:tsx          # 使用 tsx 快速啟動
pnpm dev:esbuild      # 僅 esbuild 監聽

# 建構
pnpm build            # 生產建構
pnpm build:tsc        # TypeScript 建構

# 測試
pnpm test             # 執行測試
pnpm test:e2e         # E2E 測試
pnpm vitest:ui        # 測試 UI

# 程式碼品質
pnpm lint             # 程式碼檢查
pnpm typecheck        # 型別檢查
```

### 建立新路由

1. **建立路由模組**:

```typescript
// src/delivery/http/users/routes.ts
import type { FastifyInstance } from 'fastify';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users', {
    schema: {
      description: '取得所有使用者',
      tags: ['users'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return [{ id: '1', name: 'John' }];
  });
}
```

2. **註冊模組**:

```typescript
// src/delivery/http/users/module.ts
import { userRoutes } from './routes';

export const usersModule = {
  prefix: '/api/v1',
  routes: userRoutes
};
```

3. **匯出模組**:

```typescript
// src/delivery/http/index.ts
export * from './users/module';
```

## 📚 API 文檔

### Swagger 配置

在 `http://localhost:3000/docs` 存取自動生成的文檔

功能:
- 互動式 API 測試
- 請求/回應 Schema
- 認證支援
- 匯出 OpenAPI 規格

### 新增文檔

在路由定義中使用 JSON Schema:

```typescript
fastify.post('/items', {
  schema: {
    description: '建立新項目',
    tags: ['items'],
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        price: { type: 'number' }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' }
        }
      }
    }
  }
}, async (request, reply) => {
  // 處理器實作
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
// test/health.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyServerManager } from '@/infrastructures';

describe('Health API', () => {
  let server: FastifyServerManager;

  beforeAll(async () => {
    server = new FastifyServerManager({ httpRouteModules: [] });
    await server.start();
  });

  afterAll(async () => {
    await server.close();
  });

  it('GET /health 應該返回 200', async () => {
    const response = await server.app.inject({
      method: 'GET',
      url: '/health'
    });
    
    expect(response.statusCode).toBe(200);
  });
});
```

## 🚀 部署

### Docker 部署

```bash
# 建構映像
docker build -t my-api .

# 執行容器
docker run -p 3000:3000 my-api

# 使用 docker-compose
docker-compose up -d
```

### 環境變數

```env
# .env.production
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://yourdomain.com

# API
API_PREFIX=/api/v1
```

### 生產建構

```bash
# 建構
pnpm build

# 啟動
NODE_ENV=production node dist/main.js

# 使用 PM2
pm2 start dist/main.js --name my-api
```

## ⚙️ 配置說明

### 伺服器配置

```typescript
// src/infrastructures/fastify/initialize-app.ts
export const initializeApp = (options?: FastifyServerOptions) => {
  const app = fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty'
      }
    },
    trustProxy: true,
    ...options
  });

  return app;
};
```

### CORS 設定

```typescript
// 註冊 CORS 插件
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
});
```

### 自訂插件

```typescript
// src/infrastructures/fastify/plugins/custom.ts
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  fastify.decorate('myCustomFunction', () => {
    return 'custom value';
  });
});
```

## 🔒 安全最佳實踐

- 使用環境變數儲存機密資訊
- 適當啟用 CORS
- 新增速率限制
- 驗證所有輸入
- 生產環境使用 HTTPS
- 保持依賴項更新

## 📊 效能提示

- 使用 Schema 驗證(比手動驗證快)
- 可能時啟用 HTTP/2
- 資料庫使用連線池
- 快取常存取的資料
- 使用 Fastify 指標監控

## 🤝 貢獻

歡迎貢獻!請遵循程式碼風格並為新功能新增測試。

## 📄 授權

ISC

---

**使用 [start-ts-templates](https://github.com/royfw/start-ts-templates) 建立**