---
"@rfjs/form-builder": patch
---

Docs: document `configToZod`'s boolean/`Switch` coercion behaviour — `Switch` /
`dataType: 'boolean'` fields map to a plain `z.boolean()` with no string coercion
(consumers must send a real JSON boolean), and clarify the built-in
`emptyToUndefined` empty-value guard so consumers don't rebuild that layer.
