---
"api": patch
---

refactor(templates): simplify tsconfig structure across all templates

- Remove intermediate tsconfig files (tsconfig.app.json, tsconfig.lib.json, tsconfig.spec.json)
- Unify each template to tsconfig.json + tsconfig.build.json (2 files)
- Upgrade koa-esbuild and docs templates from legacy tsconfig (NodeNext/ES2021) to modern (ES2023/bundler)
- Fix koa-esbuild isolatedModules + emitDecoratorMetadata compatibility (import type)
- Remove Jest configuration from docs templates (standardize on Vitest)
