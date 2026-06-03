---
"@rfjs/data-filter": patch
---

fix(data-filter): repair ESM build crash from lodash namespace import

`lodash` is CommonJS and stays external in the ESM bundle. The source used
`import * as _ from 'lodash'`, which resolves every lodash method to
`undefined` under Node's ESM/CJS interop — so the published `dist/index.mjs`
threw `TypeError: _.get is not a function` on the first lodash-backed call
(e.g. `resolvePath` with a comma path, `matchAndMap`'s `cloneDeep`). The unit
tests did not catch it because they run against the TypeScript source, not the
built artifact.

- Switch all nine source files to the default import `import _ from 'lodash'`
- Add an ESLint `no-restricted-syntax` rule banning the lodash namespace import so the regression cannot return
