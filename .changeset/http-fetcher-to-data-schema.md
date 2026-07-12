---
"@rfjs/data-schema": minor
"@rfjs/table-builder-ui": patch
---

Move `makeHttpFetcher` into `@rfjs/data-schema` — the RequestMeta-driven HTTP transport is pure fetch logic and belongs to the engine. `@rfjs/table-builder-ui` re-exports it, so its public API is unchanged.
