# @rfjs/es-query

## 0.1.1

### Patch Changes

- 78451a2: Escape `*`/`?`/`\` in the search term for `contains` and `endsWith` (which compile
  to ES `wildcard` queries) so a literal term containing those characters is matched
  verbatim instead of being interpreted as wildcards. `startsWith` was already safe
  (it compiles to a `prefix` query).

## 0.1.0

### Minor Changes

- ddf2103: Add `@rfjs/es-query` — compile a filter-tree to Elasticsearch / OpenSearch Query DSL bool queries, with a `dialect` flag and a `buildSearchBody` sort/pagination wrapper.
