---
"@rfjs/tpl-toolkit": patch
---

Docs: note that exported Zod builders (especially recursive `z.lazy` ones) need an
explicit `z.ZodType<T>` annotation under the tsdown `dts` output path and can't rely
on inference — a build-toolchain gotcha for consumers copying the rfjs pattern.
