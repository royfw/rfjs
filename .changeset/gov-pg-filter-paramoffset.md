---
"@rfjs/pg-filter": minor
---

buildPgFilter now accepts an optional `paramOffset` so its `$N` placeholders can start after an app-owned WHERE fragment (RLS, multi-tenancy, visibility pushdown).
