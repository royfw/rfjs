---
"@rfjs/form-builder": minor
"@rfjs/form-builder-ui": minor
---

Form preview enhancements.

`@rfjs/form-builder`: add `FormConfig.responsive.stackBelow` — the container-width breakpoint (px) below which the form collapses to a single column.

`@rfjs/form-builder-ui`: `ConfigForm` now reflows by **container** width (ResizeObserver-driven via the new `useContainerBreakpoint` hook; configurable `stackBelow`, default 640) — grid-mode and flow layouts collapse to a single column on narrow containers, so linear forms become container-responsive too. New live `onPayloadChange` seam emits `{ data, meta: SubmissionMeta }` (validated over the currently-visible fields, matching submit).
