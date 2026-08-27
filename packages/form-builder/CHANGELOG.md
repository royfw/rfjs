# @rfjs/form-builder

## 0.1.1

### Patch Changes

- 78451a2: Docs: document `configToZod`'s boolean/`Switch` coercion behaviour — `Switch` /
  `dataType: 'boolean'` fields map to a plain `z.boolean()` with no string coercion
  (consumers must send a real JSON boolean), and clarify the built-in
  `emptyToUndefined` empty-value guard so consumers don't rebuild that layer.
- Updated dependencies [78451a2]
- Updated dependencies [78451a2]
  - @rfjs/data-filter@0.3.0

## 0.1.0

### Minor Changes

- 1dac428: Add configurable button items: `ButtonItem` (`kind: 'button'`) with a `ButtonAction` union (`submit` / `reset` / `clear` / `custom` / `api`), plus optional top-level `FormConfig.id` and `FormConfig.meta` for the action payload envelope. `DataSourceRequest.method` now also accepts `PATCH`.
- d246663: Form rich inputs (F1 + F1-rich).

  `@rfjs/form-builder`: add `CheckboxGroup`, `TagList`, `FileUpload`, and `Signature` field components; add `description` (LocalizedLabel), `disabled`, `readOnly`, and `creatable` to `FieldConfig`, plus a `fileUpload` config sub-object. New exported types `FileRef`, `UploadHandler`, `SignatureTransport`, `SignatureCaptureHandle`. Multi-value components validate as arrays (`required` ⇒ at least one); single required Checkbox must be `true`.

  `@rfjs/form-builder-ui`: render the new components; honor `description`/`disabled`/`readOnly` across all controls (radix controls use `disabled` + `aria-readonly` for read-only); two new injected runtime seams `uploadHandler` and `signatureTransport` (the latter async + cancelable so a future ws/wss remote signature capture needs no schema change); submit is gated while a capture is pending.

  `@rfjs/web-ui`: add `TagInput` (options + creatable, built on command/popover) and `SignaturePad` (wraps `signature_pad`).

- a42f73d: Form preview enhancements.

  `@rfjs/form-builder`: add `FormConfig.responsive.stackBelow` — the container-width breakpoint (px) below which the form collapses to a single column.

  `@rfjs/form-builder-ui`: `ConfigForm` now reflows by **container** width (ResizeObserver-driven via the new `useContainerBreakpoint` hook; configurable `stackBelow`, default 640) — grid-mode and flow layouts collapse to a single column on narrow containers, so linear forms become container-responsive too. New live `onPayloadChange` seam emits `{ data, meta: SubmissionMeta }` (validated over the currently-visible fields, matching submit).

- 2dff4e6: Add `ResultItem` (`kind: 'result'`): an api-response display area with `mode: 'card' | 'json' | 'table'` (table reserved for @rfjs/table-builder), optional source button binding, dot-path extraction, and card item cap.
- 4cac893: Type and validate the result item `table` field as `TableConfig` (was `unknown`), backing the form result `mode:'table'` renderer.

### Patch Changes

- Updated dependencies [1aa5a4c]
- Updated dependencies [9855008]
- Updated dependencies [e8ff5da]
  - @rfjs/table-builder@0.1.0
