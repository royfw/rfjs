---
"@rfjs/data-transform": patch
---

fix(data-transform): throw a clear error on invalid dates and correct toBoolean return type

- `toDateString` now throws a descriptive `invalid date value` error instead of the opaque native `RangeError: Invalid time value` when given an unparseable input
- `toBoolean` return type narrowed from `boolean | object` to `boolean` to match its runtime behaviour (it always returns a boolean)
