# @rfjs/* Packages Migration Plan (Updated)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將分散在 rfjs-nx 和外部開發專案中的工具代碼，遷移為 rfjs monorepo 下獨立可發布的 `@rfjs/*` npm 套件。

**Architecture:** 拆成 7 個獨立套件，每個單一職責。套件間透過 workspace 依賴串接。

**Tech Stack:** TypeScript 5.7+, tsdown, Vitest

---

## Package Overview

| 套件 | 功能 | 依賴 | 測試數 |
|------|------|------|--------|
| `@rfjs/object-utils` | flatten, keysToNested, toJSONString, toFlatString | tslib | 24 |
| `@rfjs/data-transform` | typeTransfer, jsonbTypeTransfer, toBoolean, toDateString | lodash, tslib | 0 |
| `@rfjs/data-filter` | 記憶體資料過濾 + JSONPath + alias 變數替換 + filterMapping | @rfjs/object-utils, @rfjs/data-transform, lodash, jsonpath-plus | 224 |
| `@rfjs/jsonb-query` | PostgreSQL JSONB → SQL where 生成 | @rfjs/data-transform, uuid | 16 |
| `@rfjs/mongo-query` | MongoDB filter → 查詢生成 | @rfjs/data-transform | 2 |
| `@rfjs/jwt` | JWT sign/verify/decode | jsonwebtoken | 10 |
| `@rfjs/retry` | 重試邏輯 + delay | tslib | 1 |

## Source Origins

- `data-filter` 核心：rfjs-nx `packages/utils/src/query/` + 外部開發專案中的 matchQuery 模組
- `data-filter` alias：rfjs-nx `packages/utils/src/alias/`
- `object-utils`：rfjs-nx `packages/utils/src/object/`
- `data-transform`：rfjs-nx `packages/utils/src/data/`
- `jsonb-query`：rfjs-nx `packages/helpers/src/jsonb/`
- `mongo-query`：rfjs-nx `packages/helpers/src/mongo/`
- `jwt`：rfjs-nx `packages/helpers/src/jwt/`
- `retry`：rfjs-nx `packages/helpers/src/retry/`

## File Structure

```
packages/
├── object-utils/
│   ├── src/
│   │   ├── flatten.ts, flatten.spec.ts
│   │   ├── keysToNested.ts, keysToNested.spec.ts
│   │   ├── toFlatString.ts, toFlatString.spec.ts
│   │   ├── toJSONString.ts, toJSONString.spec.ts
│   │   └── index.ts
│   └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
│
├── data-transform/
│   ├── src/
│   │   ├── boolean.ts
│   │   ├── date.ts
│   │   ├── typeTransfer.ts
│   │   ├── jsonbTypeTransfer.ts
│   │   └── index.ts
│   └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
│
├── data-filter/
│   ├── src/
│   │   ├── types/ (filter.ts, index.ts)
│   │   ├── path/ (resolve.ts, resolve.spec.ts, index.ts)
│   │   ├── match/ (MatchBooleanQuery.ts, MatchNumericQuery.ts, MatchTextQuery.ts, *.spec.ts, index.ts)
│   │   ├── filter/ (filterMatchQueryData.ts, filterMappingMatchQueryData.ts, *.spec.ts, index.ts)
│   │   ├── alias/ (aliasRegex.ts, aliasValue.ts, aliasData.ts, index.ts)
│   │   └── index.ts
│   └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
│
├── jsonb-query/
│   ├── src/
│   │   ├── type.ts
│   │   ├── jsonbFromWhere.ts
│   │   ├── jsonbOperator.ts
│   │   ├── jsonbOperatorQuery.ts
│   │   ├── toQuery.ts, toQuery.spec.ts
│   │   ├── genFilterQueryMetadata.ts, genFilterQueryMetadata.spec.ts
│   │   ├── metadetaListToJsonbQuery.ts
│   │   └── index.ts
│   └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
│
├── mongo-query/
│   ├── src/
│   │   ├── query.ts
│   │   ├── toQuery.ts
│   │   ├── genFilterQuery.ts, genFilterQuery.spec.ts
│   │   └── index.ts
│   └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
│
├── jwt/
│   ├── src/
│   │   ├── jwt.ts, jwt.spec.ts
│   │   └── index.ts
│   └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
│
└── retry/
    ├── src/
    │   ├── delay.ts
    │   ├── retry.ts, retry.spec.ts
    │   └── index.ts
    └── package.json, tsconfig.json, tsdown.config.ts, vitest.config.mts
```

## Key Decisions

1. **放在 `packages/` 而非 `templates/`** — 這些是發布到 npm 的套件，不是 CLI scaffold 模板
2. **所有 `@rfjs-nx/common` 依賴移除** — 類型在各套件內本地定義
3. **所有 `@rfjs-nx/utils` 依賴移除** — 改用 `@rfjs/data-transform` 或 `@rfjs/object-utils`
4. **ESM import 風格** — 使用 `import * as _ from 'lodash'` 而非 `import _ = require('lodash')`
5. **vitest.config.mts** — 各套件使用 inline 配置，不使用 `@rfjs/tpl-toolkit`（有 `__dirname` ESM bug）
6. **isolatedDeclarations** — 所有 export 函數需加明確回傳型別註解
7. **外部開發專案字眼** — 所有 commit message、文件、註解中不保留外部專案名稱

## Implementation Status

- [x] Task 1: `@rfjs/object-utils` — 24 tests, build OK, typecheck OK
- [x] Task 2: `@rfjs/data-transform` — build OK, typecheck OK
- [x] Task 3: `@rfjs/data-filter` — 從 templates 搬遷到 packages，加入 alias + filterMapping，224 tests OK
- [x] Task 4: `@rfjs/jsonb-query` — 16 tests, build OK, typecheck OK
- [x] Task 5: `@rfjs/mongo-query` — 2 tests, build OK, typecheck OK
- [x] Task 6: `@rfjs/jwt` — 10 tests, build OK, typecheck OK
- [x] Task 7: `@rfjs/retry` — 1 test, build OK, typecheck OK
- [x] Co-Authored-By 簽名修正（14 個 commit）
- [ ] 補齊 changeset（object-utils, data-transform, data-filter, jsonb-query, mongo-query）
- [ ] 補齊 data-transform 測試
- [ ] 更新 pnpm workspace 配置（將新 packages 納入 turbo）

## Remaining Work

### 1. Changeset 補齊

jwt 和 retry 已有 changeset，需補齊以下 5 個：

```markdown
---
"@rfjs/object-utils": minor
"@rfjs/data-transform": minor
"@rfjs/data-filter": minor
"@rfjs/jsonb-query": minor
"@rfjs/mongo-query": minor
---

feat: add @rfjs/* packages — object-utils, data-transform, data-filter, jsonb-query, mongo-query

- @rfjs/object-utils: flatten, keysToNested, toJSONString, toFlatString
- @rfjs/data-transform: typeTransfer, jsonbTypeTransfer, toBoolean, toDateString
- @rfjs/data-filter: filter match query with JSONPath support, alias variable substitution, filter mapping
- @rfjs/jsonb-query: PostgreSQL JSONB SQL query builder
- @rfjs/mongo-query: MongoDB query builder from filter metadata
```

### 2. Workspace 配置

確認 `pnpm-workspace.yaml` 包含新 packages，`turbo.json` 任務配置正確。

### 3. 測試補齊

`@rfjs/data-transform` 目前無測試，建議補上 typeTransfer 和 jsonbTypeTransfer 的邊界測試。

---

## Self-Review

**Spec coverage:** 7 個套件全部建立完成，測試通過，build 和 typecheck 無誤。
**Placeholder scan:** 無 TBD/TODO。
**Type consistency:** 所有套件類型本地定義，不依賴 @rfjs-nx/common。
