---
"@rfjs/jwt": patch
---

Fix ESM build to default-import CJS-only `jsonwebtoken` so ESM consumers no longer hit `SyntaxError: Named export 'sign' not found`.
