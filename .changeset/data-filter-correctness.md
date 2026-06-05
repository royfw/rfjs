---
"@rfjs/data-filter": patch
---

fix(data-filter): literal prefix/suffix matching and no input mutation

- `startswith` / `endswith` built a `RegExp` from the raw filter value, so values
  containing regex metacharacters matched incorrectly and an invalid pattern
  (e.g. `(`) threw `SyntaxError`. They now compare literally with
  `String.prototype.startsWith` / `endsWith`.
- `matchAndMap` wrote mapping results onto the caller's original objects via the
  shared `data[dataKey]` reference; it now operates on the deep clone so input
  is never mutated.
- `aliasData` mutated and returned its input object; it now resolves placeholders
  on a clone and returns a new object.
- Fixed the README alias placeholder syntax (`${field.path}` / `$field.path`,
  not `{{field.path}}`).
