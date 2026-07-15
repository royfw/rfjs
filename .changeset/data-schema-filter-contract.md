---
"@rfjs/data-schema": minor
---

add the remote-filter contract: `DataFieldMeta.kind` ('column' | 'jsonb', authored only), `RequestMeta.filter` (`FilterRequestMeta { style: 'pg', param }`), and an opaque `BuiltRequest.filter` attached by `buildRequestParams(request, state, filter?)`
