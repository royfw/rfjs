---
"@rfjs/form-builder-ui": patch
---

fix(form-builder-ui): clear pendingCaptures on Signature unmount/config-change; a11y fallback input id

- SignatureControl status effect now emits 'idle' on cleanup so ConfigForm removes
  the key from pendingCaptures when the field unmounts (conditional hide or config change)
- ConfigForm also resets pendingCaptures in the config-change effect as an extra safeguard
- FileUpload no-handler fallback input gains id={field.key} so the section Label associates
- use-signature-capture: add comment documenting the subscribe vs result contract for transport authors
- Two new tests: pending Signature hidden by conditional and by config change both re-enable submit
