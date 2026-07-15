---
"@rfjs/sql-filter": minor
---
Column path: fix the LIKE wildcard bug (escape `%`/`_`/`\` + `ESCAPE` clause) and
make `contains`/`startswith` case-sensitive; add `endswith`, `terms` (`= ANY`),
`range` (`BETWEEN`) and the case-insensitive `iX` family (`ieq`/`ineq`/`icontains`/
`istartswith`/`iendswith`), with per-type allow-lists.
