# @rfjs/tpl-toolkit

rfjs 專案範本的共用設定工廠與建構輔助工具。

## 安裝

```bash
npm install @rfjs/tpl-toolkit
```

## 使用方式

### `createTsdownConfig(type, options)`

為不同專案類型建立 tsdown 建構設定。

```typescript
import { createTsdownConfig } from '@rfjs/tpl-toolkit';

// 函式庫設定
const config = createTsdownConfig('lib');

// 應用程式設定，自訂選項
const appConfig = createTsdownConfig('app', { entry: './src/main.ts' });
```

設定類型：`'app' | 'lib' | 'bin' | 'orm' | 'bullmq'`

### `createVitestConfig(overrides)`

建立具備合理預設值的 Vitest 測試設定。

```typescript
import { createVitestConfig } from '@rfjs/tpl-toolkit/vitest';

export default createVitestConfig({
  coverage: { enabled: true },
});
```

### Lint-Staged 設定

TypeScript 專案的預設 lint-staged 設定。

```typescript
import { defaultLintStagedConfig } from '@rfjs/tpl-toolkit';
```

### 外掛

#### `copyFilesPlugin(options)`

tsdown 外掛，在建構時複製檔案。

```typescript
import { copyFilesPlugin } from '@rfjs/tpl-toolkit/plugins';

copyFilesPlugin({ files: ['assets/**/*'] });
```

#### `tsdownDevNodemonPlugin(options)`

tsdown 外掛，開發模式下搭配 nodemon 自動重新啟動。

```typescript
import { tsdownDevNodemonPlugin } from '@rfjs/tpl-toolkit/plugins';

tsdownDevNodemonPlugin({ watch: ['src'] });
```
