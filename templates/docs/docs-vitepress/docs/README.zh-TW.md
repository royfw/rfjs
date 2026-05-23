# docs-vitepress 文檔

一個使用 VitePress 構建的強大文檔網站模板 - 為撰寫技術文檔而優化的 Vue 驅動靜態網站生成器。

## 概述

本模板提供了一個完整的基礎架構,用於建立現代化的文檔網站,使用:

- **VitePress** - Vue 驅動的靜態網站生成器
- **Vite** - 次世代前端工具
- **Vue 3** - 漸進式 JavaScript 框架
- **Markdown** - 擴展的 Markdown 支援 Vue 元件
- **TypeScript** - 型別安全開發

## 功能特性

### 核心功能

- ⚡ **極速體驗**
  - 使用 Vite 即時啟動伺服器
  - 熱模組替換 (HMR)
  - 最佳化的生產建置

- 🎨 **精美設計**
  - 現代、簡潔的 UI
  - 深色模式支援
  - 可自訂主題顏色
  - 響應式佈局

- 🔍 **強大搜尋**
  - 內建本地搜尋
  - 無需伺服器或外部依賴
  - 即時搜尋結果

- 📝 **增強 Markdown**
  - GitHub 風格 Markdown
  - 程式碼語法高亮
  - 自訂容器
  - Emoji 支援
  - 目錄

- 🌐 **國際化**
  - 一流的 i18n 支援
  - 語言切換
  - 本地化導航

- 🎯 **型別安全**
  - 完整 TypeScript 支援
  - 型別安全配置
  - IntelliSense 支援

- 🚀 **生產就緒**
  - 靜態網站生成 (SSG)
  - SEO 最佳化
  - 快速頁面載入
  - 自動程式碼分割

## 快速開始

### 前置需求

- Node.js 18 或更高版本
- pnpm 10.24.0 或更高版本

### 安裝

```bash
# 複製或克隆模板
cd docs-vitepress

# 安裝依賴
pnpm install
```

### 開發

```bash
# 啟動 VitePress 開發伺服器
pnpm docs:dev

# 文檔將在 http://localhost:5173 可用
```

### 建置

```bash
# 生產環境建置
pnpm docs:build

# 輸出將在 docs/.vitepress/dist
```

### 預覽生產建置

```bash
# 預覽已建置的網站
pnpm docs:preview
```

## 專案結構

```
docs-vitepress/
├── docs/
│   ├── .vitepress/              # VitePress 配置
│   │   ├── config.ts           # 網站配置
│   │   ├── theme/              # 自訂主題
│   │   │   ├── index.ts        # 主題進入點
│   │   │   └── style.css       # 自訂樣式
│   │   └── dist/               # 建置輸出
│   ├── public/                 # 靜態資源
│   ├── index.md                # 首頁
│   ├── guide/                  # 指南區塊
│   │   ├── index.md
│   │   └── getting-started.md
│   └── api/                    # API 參考
│       └── index.md
├── src/                        # 自訂腳本 (可選)
└── package.json
```

## 配置

### 網站配置

編輯 `docs/.vitepress/config.ts`:

```typescript
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '我的文檔',
  description: '我的優秀文檔網站',
  
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/' },
      { text: 'API', link: '/api/' }
    ],
    
    sidebar: {
      '/guide/': [
        {
          text: '介紹',
          items: [
            { text: '快速開始', link: '/guide/getting-started' },
            { text: '安裝', link: '/guide/installation' }
          ]
        }
      ]
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-repo' }
    ]
  }
});
```

### 主題自訂

在 `docs/.vitepress/theme/style.css` 中自訂顏色:

```css
:root {
  --vp-c-brand: #3F51B5;
  --vp-c-brand-light: #5C6BC0;
  --vp-c-brand-lighter: #9FA8DA;
  --vp-c-brand-dark: #303F9F;
  --vp-c-brand-darker: #283593;
}
```

### 自訂主題元件

在 `docs/.vitepress/theme/index.ts` 中擴展預設主題:

```typescript
import DefaultTheme from 'vitepress/theme';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // 註冊自訂元件
  }
};
```

## 撰寫文檔

### Frontmatter

為 Markdown 檔案新增元資料:

```markdown
---
title: 快速開始
description: 學習如何開始
layout: doc
---

# 快速開始

你的內容在此...
```

### 自訂容器

使用內建容器:

```markdown
::: info
這是一個資訊框。
:::

::: tip
這是一個提示。
:::

::: warning
這是一個警告。
:::

::: danger
這是一個危險警告。
:::

::: details 點擊查看詳情
這是一個詳情區塊。
:::
```

### 程式碼區塊

帶有語法高亮的增強程式碼區塊:

````markdown
```typescript{1,3-5}
// 第 1 行被高亮
const greeting = 'Hello';
// 第 3-5 行被高亮
function greet(name: string) {
  return `${greeting}, ${name}!`;
}
```
````

### 程式碼群組

建立分頁式程式碼區塊:

````markdown
::: code-group
```typescript [TypeScript]
const greeting: string = 'Hello';
```

```javascript [JavaScript]
const greeting = 'Hello';
```
:::
````

### 使用 Vue 元件

在 Markdown 中匯入和使用 Vue 元件:

```markdown
<script setup>
import CustomComponent from './components/CustomComponent.vue';
</script>

# 我的頁面

<CustomComponent />
```

### 目錄

自動生成目錄:

```markdown
[[toc]]
```

## 導航

### 側邊欄配置

在 `config.ts` 中配置側邊欄:

```typescript
sidebar: {
  '/guide/': [
    {
      text: '指南',
      items: [
        { text: '介紹', link: '/guide/' },
        { text: '快速開始', link: '/guide/getting-started' }
      ]
    },
    {
      text: '進階',
      items: [
        { text: '配置', link: '/guide/configuration' }
      ]
    }
  ]
}
```

### 導航欄

在 `config.ts` 中配置導航欄:

```typescript
nav: [
  { text: '首頁', link: '/' },
  { text: '指南', link: '/guide/' },
  {
    text: '下拉選單',
    items: [
      { text: '項目 A', link: '/item-a' },
      { text: '項目 B', link: '/item-b' }
    ]
  }
]
```

## 國際化

### i18n 配置

配置多語言:

```typescript
export default defineConfig({
  locales: {
    root: {
      label: 'English',
      lang: 'en'
    },
    'zh-TW': {
      label: '繁體中文',
      lang: 'zh-TW',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh-TW/guide/' }
        ]
      }
    }
  }
});
```

### 本地化內容

建立本地化目錄:

```
docs/
├── index.md              # 英文首頁
├── guide/
│   └── index.md
└── zh-TW/
    ├── index.md          # 中文首頁
    └── guide/
        └── index.md
```

## 自訂腳本

### 使用 TypeScript

如果你需要自訂腳本,模板包含建置工具:

```typescript
// src/main.ts
export function initCustomFeatures() {
  // 你的自訂邏輯
}
```

### 建置配置

```bash
# 開發建置
pnpm dev

# 生產建置
pnpm build
```

## 測試

### 單元測試

```bash
# 執行測試
pnpm test

# 使用 Vitest
pnpm vitest:run

# 使用 Jest
pnpm jest
```

### E2E 測試

```bash
# 執行 E2E 測試
pnpm test:e2e

# 含覆蓋率
pnpm vitest:e2e:run
```

## 部署

### GitHub Pages

1. 在 `config.ts` 中配置 base:
```typescript
export default defineConfig({
  base: '/your-repo-name/'
});
```

2. 建置並部署:
```bash
pnpm docs:build
# 上傳 docs/.vitepress/dist 到 GitHub Pages
```

### Netlify

1. 建置設定:
   - 建置命令: `pnpm docs:build`
   - 發布目錄: `docs/.vitepress/dist`

2. 部署

### Vercel

1. 匯入儲存庫
2. 框架預設: VitePress
3. 建置命令: `pnpm docs:build`
4. 輸出目錄: `docs/.vitepress/dist`

### Docker

```dockerfile
# 建置階段
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm docs:build

# 生產階段
FROM nginx:alpine
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 開發指令

```bash
# 文檔
pnpm docs:dev         # 啟動 VitePress 開發伺服器
pnpm docs:build       # 建置文檔
pnpm docs:preview     # 預覽生產建置

# 開發 (自訂腳本)
pnpm dev              # 使用 esbuild 啟動
pnpm dev:rollup       # Rollup 監視模式
pnpm build            # 生產建置
pnpm clean            # 清理 dist 目錄

# 測試
pnpm test             # 執行單元測試
pnpm test:e2e         # 執行 E2E 測試
pnpm vitest           # Vitest 監視模式
pnpm vitest:ui        # Vitest UI
pnpm jest             # Jest 監視模式

# 程式碼品質
pnpm lint             # 執行 ESLint
pnpm lint:fix         # 修復 ESLint 問題

# 發布
pnpm release          # 建立發布
```

## 最佳實踐

1. **內容組織**
   - 將相關內容分組到目錄中
   - 使用清晰、描述性的檔案名稱
   - 維持一致的結構

2. **Markdown 風格**
   - 使用 frontmatter 設定元資料
   - 善用自訂容器
   - 包含程式碼範例
   - 新增內部連結

3. **效能**
   - 最佳化圖片
   - 對重型元件使用延遲載入
   - 啟用快取

4. **SEO**
   - 新增有意義的標題和描述
   - 使用適當的標題層次結構
   - 包含 meta 標籤

5. **無障礙**
   - 使用語義化 HTML
   - 為圖片提供替代文字
   - 確保鍵盤導航

## 技術棧

- **框架**: VitePress 1.6+
- **建置工具**: Vite (Rollup + esbuild)
- **語言**: TypeScript 5.7+
- **UI 框架**: Vue 3
- **測試**: Vitest 3.2+ / Jest 29.7+
- **套件管理器**: pnpm 10.24+

## 故障排除

### 常見問題

**連接埠已被使用**
```bash
# 在 docs:dev 腳本中更改連接埠
vitepress dev docs --port 5174
```

**建置失敗**
```bash
# 清理並重建
rm -rf docs/.vitepress/dist
pnpm docs:build
```

**圖片無法載入**
```
# 將圖片放在 docs/public/
# 在 Markdown 中以 /image.png 引用
```

## 其他資源

- [VitePress 文檔](https://vitepress.dev/)
- [Vite 文檔](https://vitejs.dev/)
- [Vue 3 文檔](https://vuejs.org/)
- [Markdown 指南](https://www.markdownguide.org/)

## 授權

ISC

---

**屬於** [start-ts-templates](https://github.com/royfw/start-ts-templates)