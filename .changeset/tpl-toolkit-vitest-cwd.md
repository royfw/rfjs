---
"@rfjs/tpl-toolkit": patch
---

fix(tpl-toolkit): resolve createVitestConfig @ alias against the consumer cwd

`createVitestConfig` resolved its `@` alias with `path.resolve(__dirname, './src')`.
In the published ESM build `__dirname` is undefined, so consuming the factory
from a template's `vitest.config.mts` threw `ReferenceError: __dirname is not
defined`. Even where `__dirname` was shimmed it pointed at
`node_modules/@rfjs/tpl-toolkit/...` rather than the template's own `src`.

- Resolve the `@` alias against `process.cwd()` (the template running Vitest)
- Add tests covering the alias resolution and override behaviour (the package previously had none)
- Add an ESLint `no-restricted-globals` rule banning `__dirname`/`__filename` in this ESM package
