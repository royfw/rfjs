---
"@rfjs/data-transform": patch
---

Internal type-safety cleanup with no behavior or public API change: replace an unsafe `JSON.parse` return in `toBoolean` with an explicit `value === 'true'` check, and collapse the redundant `MgoDataType | DataType` union in `typeTransfer` to `DataType` (`MgoDataType` is a literal alias of `DataType`, so the signature is semantically identical). All 38 existing tests pass unchanged.
