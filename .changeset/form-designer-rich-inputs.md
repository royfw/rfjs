---
"@rfjs/form-builder": minor
"@rfjs/form-builder-ui": minor
"@rfjs/web-ui": minor
---

Form rich inputs (F1 + F1-rich).

`@rfjs/form-builder`: add `CheckboxGroup`, `TagList`, `FileUpload`, and `Signature` field components; add `description` (LocalizedLabel), `disabled`, `readOnly`, and `creatable` to `FieldConfig`, plus a `fileUpload` config sub-object. New exported types `FileRef`, `UploadHandler`, `SignatureTransport`, `SignatureCaptureHandle`. Multi-value components validate as arrays (`required` ⇒ at least one); single required Checkbox must be `true`.

`@rfjs/form-builder-ui`: render the new components; honor `description`/`disabled`/`readOnly` across all controls (radix controls use `disabled` + `aria-readonly` for read-only); two new injected runtime seams `uploadHandler` and `signatureTransport` (the latter async + cancelable so a future ws/wss remote signature capture needs no schema change); submit is gated while a capture is pending.

`@rfjs/web-ui`: add `TagInput` (options + creatable, built on command/popover) and `SignaturePad` (wraps `signature_pad`).
