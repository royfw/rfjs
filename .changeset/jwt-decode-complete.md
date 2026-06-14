---
"@rfjs/jwt": minor
---

Add `Jwt.decodeComplete(token)` — a static, no-secret full decode returning `{ header, payload, signature } | null` (wraps `jsonwebtoken.decode` with `{ complete: true }`).
