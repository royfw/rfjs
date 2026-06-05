---
"@rfjs/jwt": patch
---

fix(jwt): make decode/verify result types sound

- `decodeToken` now returns `T | null`, reflecting that `jsonwebtoken.decode` returns `null` for a malformed token
- `VerifyJWTResult` is now a discriminated union on `success`; on failure `payload` is typed `T | null` to model the case where the token could not be decoded
- `errMsg` is typed `string` (runtime messages embed dynamic values such as the expected audience/issuer/subject, so the literal-union type was inaccurate)
- `createToken` payload typed as `string | Buffer | object` instead of `any`
- Default generic for decode/verify is now `JwtPayload` instead of `any`
- Added tests covering the malformed-token decode (`null`) and verify-failure paths
