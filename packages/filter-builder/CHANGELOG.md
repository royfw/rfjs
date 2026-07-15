# @rfjs/filter-builder

## 0.1.0

### Minor Changes

- 3b4cc8f: Add the `es-query` engine: compile the canonical filter-tree to an Elasticsearch / OpenSearch `bool` query via `@rfjs/es-query`. Available through `getEngine('es-query')`.
- f2c1372: The sql-filter engine adapter now offers the new column operators
  (endswith/terms/iX for text, terms/range for numeric/date) in the editor.

### Patch Changes

- Updated dependencies [ddf2103]
- Updated dependencies [f2c1372]
- Updated dependencies [f2c1372]
  - @rfjs/es-query@0.1.0
  - @rfjs/pg-filter@0.0.1
  - @rfjs/sql-filter@0.1.0
