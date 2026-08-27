# @rfjs/form-builder-ui

## 0.1.1

### Patch Changes

- Updated dependencies [78451a2]
  - @rfjs/form-builder@0.1.1
  - @rfjs/table-builder-ui@0.1.1

## 0.1.0

### Minor Changes

- 94d76d7: ConfigForm renders configurable button items and emits a unified `{ data, meta: ActionMeta }` envelope for submit/custom/api actions (breaking: `onSubmit` now receives the envelope instead of bare values). New props: `onAction`, `metaProvider`.
- d246663: Form rich inputs (F1 + F1-rich).

  `@rfjs/form-builder`: add `CheckboxGroup`, `TagList`, `FileUpload`, and `Signature` field components; add `description` (LocalizedLabel), `disabled`, `readOnly`, and `creatable` to `FieldConfig`, plus a `fileUpload` config sub-object. New exported types `FileRef`, `UploadHandler`, `SignatureTransport`, `SignatureCaptureHandle`. Multi-value components validate as arrays (`required` ⇒ at least one); single required Checkbox must be `true`.

  `@rfjs/form-builder-ui`: render the new components; honor `description`/`disabled`/`readOnly` across all controls (radix controls use `disabled` + `aria-readonly` for read-only); two new injected runtime seams `uploadHandler` and `signatureTransport` (the latter async + cancelable so a future ws/wss remote signature capture needs no schema change); submit is gated while a capture is pending.

  `@rfjs/web-ui`: add `TagInput` (options + creatable, built on command/popover) and `SignaturePad` (wraps `signature_pad`).

- a42f73d: Form preview enhancements.

  `@rfjs/form-builder`: add `FormConfig.responsive.stackBelow` — the container-width breakpoint (px) below which the form collapses to a single column.

  `@rfjs/form-builder-ui`: `ConfigForm` now reflows by **container** width (ResizeObserver-driven via the new `useContainerBreakpoint` hook; configurable `stackBelow`, default 640) — grid-mode and flow layouts collapse to a single column on narrow containers, so linear forms become container-responsive too. New live `onPayloadChange` seam emits `{ data, meta: SubmissionMeta }` (validated over the currently-visible fields, matching submit).

- f656b1a: ConfigForm renders `result` items: api-response display areas with card / json modes (table placeholder pending @rfjs/table-builder), source-button binding, dot-path extraction, and empty / loading / error states.
- 4cac893: Render result items with `mode:'table'` using `@rfjs/table-builder-ui`'s `ConfigTable`, deriving columns from the response when no `table` config is carried.

### Patch Changes

- 11a5caa: Add the missing `"use client"` directive to the React hook modules (`useFilterTree`, `useConfigBuilder`, `useContainerBreakpoint`, `useDataSource`, `useSignatureCapture`). Importing these through a package barrel from a React Server Component (e.g. workbench's dataset explorer page) failed the Turbopack production build.
- Updated dependencies [246901f]
- Updated dependencies [f3fc709]
- Updated dependencies [1dac428]
- Updated dependencies [d246663]
- Updated dependencies [a42f73d]
- Updated dependencies [2dff4e6]
- Updated dependencies [4cac893]
- Updated dependencies [1036caf]
- Updated dependencies [9bf3b3d]
- Updated dependencies [1aa5a4c]
- Updated dependencies [9855008]
- Updated dependencies [e8ff5da]
- Updated dependencies [696edef]
- Updated dependencies [48e6e74]
- Updated dependencies [39695f4]
- Updated dependencies [6ee5368]
- Updated dependencies [54b3b32]
  - @rfjs/data-schema@0.1.0
  - @rfjs/form-builder@0.1.0
  - @rfjs/web-ui@0.1.0
  - @rfjs/table-builder-ui@0.1.0
  - @rfjs/table-builder@0.1.0
