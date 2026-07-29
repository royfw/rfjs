---
"@rfjs/data-filter": minor
---

Add the full case-insensitive text operator family for the `string` dataType —
`icontains`, `istartswith`, `iendswith`, `ieq`, `ineq` (both sides coerced with
`String(...)` then lower-cased, so a numeric/boolean/date operand never throws),
matching the vocabulary already exposed by the SQL/JSONB engines so filter trees
stay portable. The `∃` substring i-ops (`icontains`/`istartswith`/`iendswith`)
are also allowed on `string`-element arrays (evaluated per-element). Also
document the `array` membership vocabulary (`terms` = any-membership,
`containsall` = all-membership, `eq` = single membership, `contains` =
per-element substring by design) in the README so membership isn't confused with
substring matching.
