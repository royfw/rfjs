# @rfjs/data-schema-ui

Shared styled **protocol editor** (React) over
[`@rfjs/data-schema`](../data-schema): edit a `DataResourceMeta`'s
`request`/`response` protocol — endpoint, method, pagination strategy +
params, sort/filter encodings, response paths — with a built-in
"try endpoint" probe (`buildRequestParams` → `makeHttpFetcher` → `extractRows`).

Private workspace package, consumed via Next.js `transpilePackages`
(no build step). Labels are passed as props (`ProtocolPanelLabels`) so
apps keep i18n ownership.

## Usage

```tsx
import { ProtocolPanel, DEFAULT_REQUEST, DEFAULT_RESPONSE } from "@rfjs/data-schema-ui";
import type { ProtocolPanelLabels } from "@rfjs/data-schema-ui";

<ProtocolPanel
  request={request}   // RequestMeta | undefined
  response={response} // ResponseMeta | undefined
  onChange={({ request, response }) => ...}
  labels={labels}     // ProtocolPanelLabels — all strings supplied by the app
  showEnableToggle    // optional, default true — the "declare protocol" switch
/>
```

Sibling of `@rfjs/filter-builder` ↔ `@rfjs/filter-builder-ui`: the engine
(`@rfjs/data-schema`) stays framework-agnostic; this package is the thin
React editor over it.
