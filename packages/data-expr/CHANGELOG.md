# @rfjs/data-expr

## 0.1.0

### Minor Changes

- d3b9dcb: Initial release. Safe JSON expression engine wrapping JSONata (no JS eval): `compile`/`evaluate` with compile-once reuse, timeout/depth DoS guards on by default, `strict`/`onUndefined` undefined-result handling, `isExpression`/`stripExpressionPrefix` slot helpers, and typed `DataExprError`s.
