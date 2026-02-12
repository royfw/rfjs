# docs-docsify 文檔

一個由 Docsify 驅動的輕量級文檔網站模板 - 完全在瀏覽器中運作的神奇文檔網站生成器。

## 概述

本模板提供了一個完整的基礎架構,用於建立精美的文檔網站,使用:

- **Docsify** - 客戶端文檔網站生成器
- **零建置** - 無需靜態網站生成,直接在瀏覽器中執行
- **Markdown** - 使用簡單的 Markdown 格式撰寫文檔
- **esbuild/Rollup** - 自訂腳本的可選建置工具
- **Jest/Testing** - 可選的測試基礎設施

## 功能特性

### 核心功能

- 📝 **無需建置**
  - 無需靜態網站生成
  - 文檔無需建置步驟
  - 即時預覽和部署

- 🎨 **開箱即美**
  - 多個內建主題
  - 響應式設計
  - 可自訂樣式

- 🔍 **全文搜尋**
  - 內建搜尋插件
  - 無需伺服器
  - 支援離線工作

- 🌐 **多語言支援**
  - 簡易 i18n 設定
  - 語言切換
  - 本地化導航

- 🔌 **豐富的插件生態系統**
  - 語法高亮
  - Emoji 支援
  - 複製程式碼按鈕
  - 還有更多

- 📱 **行動裝置友善**
  - 響應式佈局
  - 觸控友善導航
  - PWA 就緒

## 快速開始

### 前置需求

- Node.js 18 或更高版本
- pnpm 10.24.0 或更高版本 (用於自訂腳本)

### 安裝

```bash
# 複製或克隆模板
cd docs-docsify

# 安裝依賴 (如果使用自訂腳本)
pnpm install
```

### 開發

#### 選項 1: 簡單靜態伺服器

```bash
# 使用任何靜態伺服器
npx serve docs

# 或使用 Python
python -m http.server 3000 --directory docs

# 或使用 PHP
php -S localhost:3000 -t docs
```

#### 選項 2: 使用建置工具

```bash
# 啟動開發伺服器
pnpm dev

# 文檔將在 http://localhost:3000 可用
```

### 部署

Docsify 網站可以部署到任何靜態託管服務:

```bash
# docs/ 目錄包含所有部署所需的內容
# 只需上傳到你的託管服務
```

## 專案結構

```
docs-docsify/
├── docs/                      # 文檔來源
│   ├── index.html            # Docsify 進入點
│   ├── README.md             # 首頁內容
│   ├── .nojekyll             # 防止 Jekyll 處理
│   ├── _sidebar.md           # 側邊欄導航 (可選)
│   ├── _navbar.md            # 頂部導航欄 (可選)
│   ├── _coverpage.md         # 封面頁 (可選)
│   └── guide/                # 文檔區塊
│       ├── quickstart.md
│       └── ...
├── src/                      # 自訂腳本 (可選)
│   └── main.ts
└── package.json              # 建置工具配置 (可選)
```

## 配置

### 基本配置

編輯 `docs/index.html` 以配置 Docsify:

```html
<script>
  window.$docsify = {
    name: 'Your Project',
    repo: 'your-username/your-repo',
    loadSidebar: true,
    subMaxLevel: 2,
    search: {
      placeholder: 'Search...',
      noData: 'No results found'
    }
  }
</script>
```

### 常用選項

```javascript
window.$docsify = {
  // 專案名稱
  name: 'docs-docsify',
  
  // GitHub 儲存庫
  repo: 'your-username/docs-docsify',
  
  // 側邊欄
  loadSidebar: true,
  subMaxLevel: 3,
  
  // 導航欄
  loadNavbar: true,
  
  // 封面頁
  coverpage: true,
  
  // 搜尋
  search: {
    placeholder: '輸入以搜尋',
    noData: '無結果!',
    depth: 6
  },
  
  // 主題
  themeColor: '#3F51B5',
  
  // 自動回到頂部
  auto2top: true
}
```

## 撰寫文檔

### 建立頁面

在 `docs/` 目錄中建立 Markdown 檔案:

```markdown
# 頁面標題

你的內容在此...

## 區塊

更多內容...
```

### 側邊欄導航

建立 `docs/_sidebar.md`:

```markdown
* [首頁](/zh-TW/)
* [指南](guide/)
  * [快速開始](guide/quickstart.md)
  * [配置](guide/configuration.md)
* [API](api/)
  * [方法](api/methods.md)
```

### 頂部導航

建立 `docs/_navbar.md`:

```markdown
* [English](/)
* [中文](/zh-TW/)

* 入門
  * [快速開始](quickstart.md)
  * [撰寫更多頁面](more-pages.md)
```

### 封面頁

建立 `docs/_coverpage.md`:

```markdown
![logo](_media/icon.svg)

# 我的文檔

> 一個很棒的文檔網站。

* 簡單且輕量
* 無需建置過程
* 多個主題

[GitHub](https://github.com/your-repo/)
[開始使用](#introduction)
```

## 插件

### 必要插件

模板中已包含:

```html
<!-- 搜尋 -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/search.min.js"></script>

<!-- Emoji -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/emoji.min.js"></script>

<!-- 複製程式碼 -->
<script src="//cdn.jsdelivr.net/npm/docsify-copy-code"></script>

<!-- 語法高亮 -->
<script src="//cdn.jsdelivr.net/npm/prismjs/components/prism-bash.min.js"></script>
<script src="//cdn.jsdelivr.net/npm/prismjs/components/prism-typescript.min.js"></script>
```

### 額外插件

在 `index.html` 中包含腳本以新增更多插件:

```html
<!-- 分頁 -->
<script src="//cdn.jsdelivr.net/npm/docsify-pagination/dist/docsify-pagination.min.js"></script>

<!-- 標籤頁 -->
<script src="//cdn.jsdelivr.net/npm/docsify-tabs@1"></script>

<!-- 圖片縮放 -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/zoom-image.min.js"></script>
```

## 主題

### 內建主題

在 `index.html` 中修改 CSS 連結以更改主題:

```html
<!-- Vue 主題 (預設) -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/vue.css">

<!-- 暗黑主題 -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/dark.css">

<!-- Buble 主題 -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/buble.css">

<!-- Pure 主題 -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/pure.css">
```

### 自訂樣式

在 `index.html` 中新增自訂 CSS:

```html
<style>
  :root {
    --theme-color: #3F51B5;
    --base-font-size: 16px;
  }
</style>
```

## 自訂腳本

### 使用 TypeScript

如果你需要自訂腳本,模板包含建置工具:

```typescript
// src/main.ts
export function initCustomFeatures() {
  // 你的自訂邏輯
}

// 從 docs/index.html 呼叫
window.initCustomFeatures();
```

### 建置配置

```bash
# 開發建置
pnpm dev:esbuild   # 或 dev:rollup

# 生產建置
pnpm build
```

## 測試

### 單元測試

```bash
# 執行測試
pnpm test

# 監視模式
pnpm jest:watch

# 覆蓋率
pnpm jest:cov
```

### E2E 測試

```bash
# 執行 E2E 測試
pnpm test:e2e

# 含覆蓋率
pnpm jest:e2e:cov
```

## 部署

### GitHub Pages

1. 將程式碼推送到 GitHub
2. 前往儲存庫 Settings → Pages
3. 選擇來源: main branch / docs 資料夾
4. 你的網站將在 `https://username.github.io/repo-name/` 可用

### Netlify

1. 將儲存庫連接到 Netlify
2. 建置設定:
   - 建置命令: (留空或使用自訂建置)
   - 發布目錄: `docs`
3. 部署

### Vercel

1. 匯入你的儲存庫
2. 框架預設: Other
3. 根目錄: `docs`
4. 部署

### Docker

```dockerfile
FROM nginx:alpine
COPY docs /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# 建置並執行
docker build -t my-docs .
docker run -p 8080:80 my-docs
```

## 開發指令

```bash
# 開發
pnpm dev               # 使用預設建置器啟動
pnpm dev:esbuild      # esbuild 監視模式
pnpm dev:rollup       # Rollup 監視模式
pnpm start            # 執行已建置的應用

# 建置
pnpm build            # 生產建置
pnpm build:esbuild    # 使用 esbuild 建置
pnpm build:rollup     # 使用 Rollup 建置
pnpm clean            # 清理 dist 目錄

# 測試
pnpm test             # 執行單元測試
pnpm test:e2e         # 執行 E2E 測試
pnpm jest             # Jest 監視模式
pnpm jest:cov         # 覆蓋率報告

# 程式碼品質
pnpm lint             # 執行 ESLint
pnpm lint:fix         # 修復 ESLint 問題

# 發布
pnpm release          # 建立發布
```

## 最佳實踐

1. **文檔組織**
   - 將相關頁面放在子目錄中
   - 使用清晰、描述性的檔案名稱
   - 維持邏輯層次結構

2. **Markdown 風格**
   - 使用一致的標題層級
   - 包含程式碼範例
   - 在相關頁面間新增連結

3. **導航**
   - 保持側邊欄有組織
   - 為複雜文檔使用巢狀導航
   - 為深層層次結構新增麵包屑

4. **效能**
   - 最佳化圖片
   - 為資源使用 CDN
   - 啟用快取

5. **SEO**
   - 使用描述性頁面標題
   - 新增 meta 描述
   - 自然地包含關鍵字

## 技術棧

- **框架**: Docsify (客戶端)
- **語言**: TypeScript 5.7+ (用於自訂腳本)
- **建置工具**: esbuild 0.25+ / Rollup 4.36+ (可選)
- **測試**: Jest 29.7+ (可選)
- **套件管理器**: pnpm 10.24+ (可選)

## 故障排除

### 常見問題

**側邊欄未顯示**
```javascript
// 確保啟用 loadSidebar
window.$docsify = {
  loadSidebar: true
}
```

**搜尋無法運作**
```html
<!-- 確保包含搜尋插件 -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/search.min.js"></script>
```

**GitHub Pages 出現 404**
```
# 確保 docs/ 中存在 .nojekyll 檔案
touch docs/.nojekyll
```

## 其他資源

- [Docsify 文檔](https://docsify.js.org/)
- [Docsify 插件](https://docsify.js.org/#/plugins)
- [Awesome Docsify](https://github.com/docsifyjs/awesome-docsify)
- [Markdown 指南](https://www.markdownguide.org/)

## 授權

ISC

---

**屬於** [start-ts-templates](https://github.com/royfw/start-ts-templates)