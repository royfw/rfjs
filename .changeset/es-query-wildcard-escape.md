---
"@rfjs/es-query": patch
---

Escape `*`/`?`/`\` in the search term for `contains` and `endsWith` (which compile
to ES `wildcard` queries) so a literal term containing those characters is matched
verbatim instead of being interpreted as wildcards. `startsWith` was already safe
(it compiles to a `prefix` query).
