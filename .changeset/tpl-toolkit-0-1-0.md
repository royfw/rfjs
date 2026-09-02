---
"@rfjs/tpl-toolkit": minor
---

Promote to `0.1.0` so consumers can receive patches.

This is a stability signal, not a feature release. On `0.0.x` a caret range does not
widen: when both major and minor are `0`, `^0.0.1` matches `0.0.1` and nothing else. So
every template that declared `"@rfjs/tpl-toolkit": "^0.0.1"` was pinned to an exact
version, and the `__dirname`-in-ESM fix shipped in `0.0.2` could not reach any of them —
no `pnpm update` would ever have delivered it. It took a human noticing broken tests two
releases later (#300).

From `0.1.0` onward, `^0.1.0` widens across patches — `0.1.1`, `0.1.2`, … all satisfy it —
so fixes reach consumers the way they already expect, and the class of bug closes.

The version number is also a promise about the surface. The exported factories
(`createTsdownConfig`, `createVitestConfig`), the lint-staged constants
(`defaultLintStagedConfig`, `defaultLintStagedConfigNoTest`) and the build plugins
(`copyFilesPlugin`, `tsdownDevNodemonPlugin`, `copyPackageJsonPlugin` and its
tsdown/esbuild/rollup shortcuts) keep the signatures and export paths they have today;
patches will carry fixes, not reshapes. Anything that changes those shapes gets a minor.

No runtime behavior changes in this release. The templates' specifiers are swept to
`^0.1.0` separately, after this version exists on npm.

Closes #306.
