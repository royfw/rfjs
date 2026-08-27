---
"@rfjs/form-builder": patch
---

Fix typecheck: declare the conditional-rule schema as `ZodType<ConditionalRule>` instead of `ZodTypeAny` so it satisfies `ZodType<FormConfig>`, and add `DOM` to the package `lib` so the `File`/`AbortSignal` globals already in the published types resolve.
