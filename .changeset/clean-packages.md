---
"@rfjs/data-filter": minor
"@rfjs/data-transform": patch
"@rfjs/jsonb-query": patch
"@rfjs/mongo-query": patch
"@rfjs/jwt": patch
"@rfjs/retry": patch
"@rfjs/object-utils": patch
---

chore(packages): cleanup template boilerplate, refactor names, add DateFilterOperator

- Remove template docs boilerplate from 6 packages
- Clean redundant per-package config (husky, commitlint, pnpm-lock, pnpm-workspace, tpl-toolkit)
- Shorten function/class names: matchQuery, matchAndMap, resolvePath, TextMatch, NumericMatch, BooleanMatch, createMatchQuery, jsonbTransfer, genJsonbQuery, toJsonbQueryList
- Add DateFilterOperator support to data-filter with DateMatch class (eq, neq, isnull, isnotnull, gt, gte, lt, lte, range, terms)
