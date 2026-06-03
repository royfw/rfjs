---
"@rfjs/data-filter": patch
"@rfjs/data-transform": patch
"@rfjs/jsonb-query": patch
"@rfjs/jwt": patch
"@rfjs/mongo-query": patch
"@rfjs/object-utils": patch
"@rfjs/retry": patch
---

chore(packages): unify npm publish config and trim redundant runtime deps

- Add `exports` map, `publishConfig.access: "public"`, and `sideEffects: false` to all seven packages so scoped packages publish publicly and consumers can tree-shake
- Include README.md / README.zh-TW.md in the published `files`
- Drop unused `tslib` runtime dependency (verified absent from built dist; pg-toolkit keeps it as it is still emitted there)
- data-filter: remove unused `@rfjs/data-transform` dependency
- data-transform: replace lodash `_.has` with native `Object.prototype.hasOwnProperty`, dropping `lodash` and `@types/lodash`
