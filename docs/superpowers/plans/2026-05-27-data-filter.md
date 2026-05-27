# @rfjs/data-filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 `@rfjs/data-filter` npm 套件，將分散在 rfjs-nx 和 外部開發 兩處的 matchQuery 代碼合併為一個獨立的可發布包。

**Architecture:** 以 外部開發 版本為基礎（自包含 + JSONPath 支援），移除 rfjs-nx 特有的 `filterMappingMatchQueryData`（依賴 `aliasData`，屬於另一關注點）。使用 `lib-tsdown` 模板結構，依賴 `lodash` 和 `jsonpath-plus`。

**Tech Stack:** TypeScript 5.7+, tsdown, Vitest, lodash, jsonpath-plus

---

## File Structure

```
templates/libs/data-filter/
├── package.json                    # @rfjs/data-filter, deps: lodash, jsonpath-plus, tslib
├── tsconfig.json                   # 從 lib-tsdown 模板複製
├── tsconfig.build.json             # 從 lib-tsdown 模板複製
├── tsdown.config.ts                # 從 lib-tsdown 模板複製
├── vitest.config.mts               # 從 lib-tsdown 模板複製
├── eslint.config.mjs               # 從 lib-tsdown 模板複製
├── .prettierrc                     # 從 lib-tsdown 模板複製
├── .npmrc                          # 從 lib-tsdown 模板複製
├── .nvmrc                          # 從 lib-tsdown 模板複製
├── commitlint.config.js            # 從 lib-tsdown 模板複製
├── pnpm-workspace.yaml             # packages: ["."]
├── .eslintrc.cache/                # 從 lib-tsdown 模板複製（如有）
└── src/
    ├── index.ts                    # 統一 re-export
    ├── types/
    │   ├── index.ts                # re-export types
    │   └── filter.ts               # FilterMatchQuery, MatchQueryMetadata, LogicalOperator 等所有類型
    ├── path/
    │   ├── index.ts                # re-export path 工具
    │   └── resolve.ts              # resolvePathWithWildcard, resolvePathWithWildcardDetailed + 內部 helper
    ├── match/
    │   ├── index.ts                # re-export Match*Query classes
    │   ├── MatchBooleanQuery.ts
    │   ├── MatchNumericQuery.ts
    │   └── MatchTextQuery.ts
    ├── filter/
    │   ├── index.ts                # re-export filter 函數
    │   └── filterMatchQueryData.ts # filterMatchQueryArrayData, filterMatchQueryData, factoryMatchQuery, typeTransfer
    └── *.spec.ts                   # 測試文件與對應源文件同目錄
```

## Source Layout Decision

- 測試文件放在與源文件同級的 `src/` 下（如 `src/path/resolve.spec.ts`），符合模板 `vitest.config.mts` 的預設配置
- `filterMappingMatchQueryData.ts` **不納入** — 它依賴 `aliasData`（rfjs-nx 內部模組），屬於獨立的 mapping 功能
- 所有類型從 `@rfjs-nx/common` 的依賴移除，全部自定義在 `src/types/`

---

### Task 1: Scaffold the package from lib-tsdown template

**Files:**
- Create: `templates/libs/data-filter/` (all template config files)
- Command: `cp -r templates/libs/lib-tsdown templates/libs/data-filter`

- [ ] **Step 1: Copy the lib-tsdown template**

```bash
cd /home/royfw/_/royfw/_apps/rfjs
cp -r templates/libs/lib-tsdown templates/libs/data-filter
```

- [ ] **Step 2: Update package.json**

Edit `templates/libs/data-filter/package.json`:
```json
{
  "name": "@rfjs/data-filter",
  "version": "0.0.0",
  "description": "Data filtering with JSONPath support — match query, wildcard path resolution, and logic operators",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "private": false,
  "files": ["dist/**"],
  "dependencies": {
    "lodash": "^4.17.21",
    "jsonpath-plus": "^10.0.0",
    "tslib": "^2.8.1"
  },
  "devDependencies": {
    "@types/lodash": "^4.17.15",
    "@types/jsonpath-plus": "^0.2.0"
  }
}
```

保留 devDependencies 中的工具（eslint、vitest、tsdown、husky 等）不變。移除不需要的 `@types/supertest`、`supertest`、`vitepress`。

- [ ] **Step 3: Remove template source files**

```bash
rm -rf templates/libs/data-filter/src/*
```

- [ ] **Step 4: Install dependencies**

```bash
cd templates/libs/data-filter
pnpm install
```

- [ ] **Step 5: Verify clean build**

```bash
cd templates/libs/data-filter
pnpm build
pnpm typecheck
```

Expected: build succeeds with empty re-export (will add `src/index.ts` next).

- [ ] **Step 6: Commit**

```bash
git add templates/libs/data-filter/
git commit -m "feat: scaffold @rfjs/data-filter package from lib-tsdown template"
```

---

### Task 2: Add types

**Files:**
- Create: `templates/libs/data-filter/src/types/filter.ts`
- Create: `templates/libs/data-filter/src/types/index.ts`

- [ ] **Step 1: Write src/types/filter.ts**

```typescript
export type FilterMatchQuery = {
  logic: LogicalOperator;
  filters: (MatchQueryMetadata | FilterMatchQuery)[];
};

export type MatchQueryDataType = 'string' | 'numeric' | 'boolean';

export type MatchQueryMetadata = {
  field: string;
  dataType: MatchQueryDataType;
  operator:
    | DefaultFilterOperator
    | TextFilterOperator
    | NumericFilterOperator
    | BooleanFilterOperator;
  value: ValueType;
};

export type LogicalOperator = 'and' | 'or' | 'nor' | 'not';

export type DefaultFilterOperator = 'eq' | 'neq' | 'isnull' | 'isnotnull';

export type TextFilterOperator =
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'terms'
  | DefaultFilterOperator;

export type NumericFilterOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms'
  | DefaultFilterOperator;

export type DateFilterOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'range'
  | 'terms'
  | DefaultFilterOperator;

export type BooleanFilterOperator = DefaultFilterOperator;

export type ValueType =
  | string
  | string[]
  | number
  | number[]
  | Date
  | Date[]
  | boolean
  | boolean[]
  | any;

export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'any'
  | 'integer'
  | 'date';

export type ObjectData = {
  [key: string]: ValueType;
};

export interface PathResolveOptions {
  fallbackToLodash?: boolean;
  fallbackOnEmpty?: boolean;
}

export interface PathResolveResult {
  value: any;
  usedJsonPath: boolean;
  isWildcardResult: boolean;
}
```

注意：原始代碼中 `TextFilterOperator` 和 `NumericFilterOperator` 使用了 `(DefaultFilterOperator & 'gt')` 這種 never-type 寫法（函數簽名中不會出錯但語義不清），這裡改為直接 union，功能相同且更清晰。

- [ ] **Step 2: Write src/types/index.ts**

```typescript
export * from './filter';
```

- [ ] **Step 3: Commit**

```bash
git add templates/libs/data-filter/src/types/
git commit -m "feat(data-filter): add type definitions"
```

---

### Task 3: Add path resolution module

**Files:**
- Create: `templates/libs/data-filter/src/path/resolve.ts`
- Create: `templates/libs/data-filter/src/path/index.ts`
- Create: `templates/libs/data-filter/src/path/resolve.spec.ts`

- [ ] **Step 1: Write src/path/resolve.ts**

從 外部開發 `resolvePathWithWildcard.ts` 搬移，修正 import 路徑：

```typescript
import _ = require('lodash');
import { JSONPath as JSONPathQuery } from 'jsonpath-plus';
import type { PathResolveOptions, PathResolveResult } from '../types';

function hasCommaOutsideBrackets(path: string): boolean {
  return path.includes(',') && !/\[[^\]]*,/.test(path);
}

function hasWildcardSyntax(path: string): boolean {
  return (
    path.includes('*') ||
    /\[[^\]]*,/.test(path) ||
    path.includes('..') ||
    /\[[^\]]*:/.test(path) ||
    /\[\?/.test(path)
  );
}

export function resolvePathWithWildcard(
  data: any,
  path: string,
  options: PathResolveOptions = {},
): any {
  const { fallbackToLodash = true, fallbackOnEmpty = true } = options;

  if (hasCommaOutsideBrackets(path)) {
    return _.get(data, path);
  }

  const hasWildcard = hasWildcardSyntax(path);

  try {
    const jsonPath = path.startsWith('$') ? path : `$.${path}`;
    const result = JSONPathQuery({
      path: jsonPath,
      json: data,
    });

    if (result.length === 0 && !hasWildcard && fallbackOnEmpty) {
      return _.get(data, path);
    }

    return hasWildcard ? result : result[0] ?? null;
  } catch (error) {
    if (fallbackToLodash) {
      return _.get(data, path);
    }
    throw error;
  }
}

export function resolvePathWithWildcardDetailed(
  data: any,
  path: string,
  options: PathResolveOptions = {},
): PathResolveResult {
  const { fallbackToLodash = true, fallbackOnEmpty = true } = options;

  if (hasCommaOutsideBrackets(path)) {
    return {
      value: _.get(data, path),
      usedJsonPath: false,
      isWildcardResult: false,
    };
  }

  const hasWildcard = hasWildcardSyntax(path);

  try {
    const jsonPath = path.startsWith('$') ? path : `$.${path}`;
    const result = JSONPathQuery({
      path: jsonPath,
      json: data,
    });

    if (result.length === 0 && !hasWildcard && fallbackOnEmpty) {
      return {
        value: _.get(data, path),
        usedJsonPath: false,
        isWildcardResult: false,
      };
    }

    return {
      value: hasWildcard ? result : result[0] ?? null,
      usedJsonPath: true,
      isWildcardResult: hasWildcard,
    };
  } catch (error) {
    if (fallbackToLodash) {
      return {
        value: _.get(data, path),
        usedJsonPath: false,
        isWildcardResult: false,
      };
    }
    throw error;
  }
}
```

- [ ] **Step 2: Write src/path/index.ts**

```typescript
export * from './resolve';
```

- [ ] **Step 3: Write src/path/resolve.spec.ts**

從 外部開發 `resolvePathWithWildcard.spec.ts` 完整搬移所有測試（包含簡單路徑、萬用字元、陣列索引聯合、遞迴搜尋、陣列切片、過濾表達式、特殊情況、錯誤處理、選項參數、以及 `resolvePathWithWildcardDetailed` 的全部測試）。

- [ ] **Step 4: Run tests**

```bash
cd templates/libs/data-filter
pnpm vitest:run
```

Expected: All resolve.spec.ts tests pass.

- [ ] **Step 5: Commit**

```bash
git add templates/libs/data-filter/src/path/
git commit -m "feat(data-filter): add JSONPath path resolution module"
```

---

### Task 4: Add MatchQuery classes

**Files:**
- Create: `templates/libs/data-filter/src/match/MatchBooleanQuery.ts`
- Create: `templates/libs/data-filter/src/match/MatchNumericQuery.ts`
- Create: `templates/libs/data-filter/src/match/MatchTextQuery.ts`
- Create: `templates/libs/data-filter/src/match/index.ts`

- [ ] **Step 1: Write src/match/MatchBooleanQuery.ts**

從 外部開發 版本搬移，修正 import 路徑：

```typescript
import _ = require('lodash');
import { typeTransfer } from '../filter/filterMatchQueryData';
import type { BooleanFilterOperator, ObjectData } from '../types';
import { resolvePathWithWildcard } from '../path/resolve';

export class MatchBooleanQuery {
  // ... 與 外部開發 版本完全相同，僅 import 路徑改為相對路徑
}
```

- [ ] **Step 2: Write src/match/MatchNumericQuery.ts**

從 外部開發 版本搬移，修正 import 路徑：

```typescript
import _ = require('lodash');
import { typeTransfer } from '../filter/filterMatchQueryData';
import type {
  NumericFilterOperator,
  DefaultFilterOperator,
  ObjectData,
} from '../types';
import { resolvePathWithWildcard } from '../path/resolve';

export class MatchNumericQuery {
  // ... 與 外部開發 版本完全相同，僅 import 路徑改為相對路徑
}
```

- [ ] **Step 3: Write src/match/MatchTextQuery.ts**

從 外部開發 版本搬移，修正 import 路徑：

```typescript
import _ = require('lodash');
import { typeTransfer } from '../filter/filterMatchQueryData';
import type { TextFilterOperator, DefaultFilterOperator, ObjectData } from '../types';
import { resolvePathWithWildcard } from '../path/resolve';

export class MatchTextQuery {
  // ... 與 外部開發 版本完全相同，僅 import 路徑改為相對路徑
}
```

- [ ] **Step 4: Write src/match/index.ts**

```typescript
export * from './MatchBooleanQuery';
export * from './MatchNumericQuery';
export * from './MatchTextQuery';
```

- [ ] **Step 5: Commit**

```bash
git add templates/libs/data-filter/src/match/
git commit -m "feat(data-filter): add MatchQuery classes (Boolean, Numeric, Text)"
```

---

### Task 5: Add filter module

**Files:**
- Create: `templates/libs/data-filter/src/filter/filterMatchQueryData.ts`
- Create: `templates/libs/data-filter/src/filter/index.ts`

- [ ] **Step 1: Write src/filter/filterMatchQueryData.ts**

從 外部開發 版本搬移，修正 import 路徑：

```typescript
import _ = require('lodash');
import { MatchBooleanQuery } from '../match/MatchBooleanQuery';
import { MatchNumericQuery } from '../match/MatchNumericQuery';
import { MatchTextQuery } from '../match/MatchTextQuery';
import type {
  DataType,
  ObjectData,
  FilterMatchQuery,
  MatchQueryMetadata,
  LogicalOperator,
  TextFilterOperator,
  NumericFilterOperator,
  BooleanFilterOperator,
} from '../types';

// ... filterMatchQueryArrayData, filterMatchQueryData, logicMatchQuery,
//     isFilterMatchQuery, factoryMatchQuery, typeTransfer
// 與 外部開發 版本完全相同，僅 import 路徑改為相對路徑
```

- [ ] **Step 2: Write src/filter/index.ts**

```typescript
export * from './filterMatchQueryData';
```

- [ ] **Step 3: Commit**

```bash
git add templates/libs/data-filter/src/filter/
git commit -m "feat(data-filter): add filter module (filterMatchQueryArrayData, typeTransfer)"
```

---

### Task 6: Add all test files and main index.ts

**Files:**
- Create: `templates/libs/data-filter/src/filter/filterMatchQueryArrayData.spec.ts`
- Create: `templates/libs/data-filter/src/match/MatchBooleanQuery.spec.ts`
- Create: `templates/libs/data-filter/src/match/MatchNumericQuery.spec.ts`
- Create: `templates/libs/data-filter/src/match/MatchTextQuery.spec.ts`
- Create: `templates/libs/data-filter/src/index.ts`

- [ ] **Step 1: Write src/index.ts**

```typescript
export * from './types';
export * from './path';
export * from './match';
export * from './filter';
```

- [ ] **Step 2: Move all spec files from 外部開發**

將以下測試文件從 外部開發 版本搬移，修正 import 路徑：
- `filterMatchQueryArrayData.spec.ts` → `src/filter/filterMatchQueryArrayData.spec.ts`
- `MatchBooleanQuery.spec.ts` → `src/match/MatchBooleanQuery.spec.ts`
- `MatchNumericQuery.spec.ts` → `src/match/MatchNumericQuery.spec.ts`
- `MatchTextQuery.spec.ts` → `src/match/MatchTextQuery.spec.ts`

所有 import 從 `./xxx` 改為相對路徑（例：`import { MatchBooleanQuery } from './MatchBooleanQuery'` 不變，因為 spec 和源文件同目錄）。

- [ ] **Step 3: Run all tests**

```bash
cd templates/libs/data-filter
pnpm vitest:run
```

Expected: All tests pass (包含原 外部開發 的所有測試 + JSONPath 進階測試)。

- [ ] **Step 4: Run build and typecheck**

```bash
pnpm build
pnpm typecheck
```

Expected: Both succeed with no errors.

- [ ] **Step 5: Run lint**

```bash
pnpm lint
```

Expected: No errors (or fix any lint issues).

- [ ] **Step 6: Commit**

```bash
git add templates/libs/data-filter/
git commit -m "feat(data-filter): add tests and main index re-export, complete initial implementation"
```

---

### Task 7: Register in template registry and final verification

**Files:**
- Modify: `templates/registry.json`

- [ ] **Step 1: Add to registry.json**

在 `templates/registry.json` 的 `templates` 陣列中加入：

```json
{
  "id": "libs/data-filter",
  "path": "templates/libs/data-filter",
  "title": "Data Filter (JSONPath match query library)"
}
```

放在 `libs/lib-tsdown` 條目之後。

- [ ] **Step 2: Full verification**

```bash
cd templates/libs/data-filter
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Expected: All pass.

- [ ] **Step 3: Verify package exports**

確認 `dist/` 輸出包含：
- `dist/index.js` — CommonJS entry
- `dist/index.mjs` — ESM entry
- `dist/index.d.ts` — Type declarations

- [ ] **Step 4: Commit**

```bash
git add templates/registry.json templates/libs/data-filter/
git commit -m "feat(data-filter): register in template registry and verify build"
```

---

## Self-Review

**Spec coverage:**
- [x] 從 lib-tsdown 模板建立新套件
- [x] 合併 rfjs-nx + 外部開發 兩處代碼（以 外部開發 為基礎，功能超集）
- [x] 所有類型自定義（不依賴 @rfjs-nx/common）
- [x] JSONPath 支援包含在內
- [x] 所有測試搬移
- [x] 命名為 @rfjs/data-filter
- [x] filterMappingMatchQueryData 排除（依賴 aliasData，獨立關注點）
- [x] 註冊到 template registry

**Placeholder scan:** 無 "TBD"/"TODO"/"類似 Task N" 等佔位符。每步都有完整代碼或明確的搬移指令。

**Type consistency:** `TextFilterOperator` 和 `NumericFilterOperator` 從原始的 `(DefaultFilterOperator & 'gt')` never-type 改為直接 union。這不會破壞任何現有呼叫，因為原始寫法在 TypeScript 中實際上等同於整個 union。MatchQuery classes 的建構子簽名保持不變。
