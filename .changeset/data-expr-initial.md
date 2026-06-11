---
"@rfjs/data-expr": minor
---

Initial release. Safe JSON expression engine wrapping JSONata (no JS eval): `compile`/`evaluate` with compile-once reuse, timeout/depth DoS guards on by default, `strict`/`onUndefined` undefined-result handling, `isExpression`/`stripExpressionPrefix` slot helpers, and typed `DataExprError`s.
