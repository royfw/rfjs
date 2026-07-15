# @rfjs/data-schema

## 0.1.0

### Minor Changes

- 246901f: add the remote-filter contract: `DataFieldMeta.kind` ('column' | 'jsonb', authored only), `RequestMeta.filter` (`FilterRequestMeta { style: 'pg', param }`), and an opaque `BuiltRequest.filter` attached by `buildRequestParams(request, state, filter?)`
- f3fc709: New package: data resource metadata contract — field metadata (key/label/dataType/format/options/sortable), request protocol (offset/page/cursor pagination + sort encodings), response envelope paths, with zod validation and infer/build/extract helpers.
- 1036caf: Move `makeHttpFetcher` into `@rfjs/data-schema` — the RequestMeta-driven HTTP transport is pure fetch logic and belongs to the engine. `@rfjs/table-builder-ui` re-exports it, so its public API is unchanged.
