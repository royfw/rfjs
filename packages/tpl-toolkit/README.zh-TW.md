# @rfjs/tpl-toolkit

rfjs 專案範本的共用設定工廠與建構輔助工具。

## 安裝

```bash
npm install @rfjs/tpl-toolkit
```

## 版本策略

請以 caret 指定相依 —`"@rfjs/tpl-toolkit": "^0.1.0"`— 之後執行 `pnpm update` 即可取得 patch
修正。跨 patch 版本時，匯出的設定工廠、常數與外掛都會維持既有的簽章與匯出路徑；任何改變這些形狀
的變更都會以 minor 發布。

這只在 `0.1.0` 之後成立。在先前的 `0.0.x` 版號序列中，caret 不會放寬範圍：當 major 與 minor 都是
`0` 時，`^0.0.1` 只會匹配 `0.0.1`，不會匹配其他版本。因此每個使用者實際上都被鎖在一個確切版本，
必須手動改版號才能拿到修正 —— `0.0.2` 的修正就這樣連續兩個 release 沒有送達任何人，直到有人發現
測試壞掉。若你目前仍使用 `0.0.x` 指定字串，請手動改成 `^0.1.0` 一次，之後 patch 就會自動跟上。

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
