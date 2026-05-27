# @rfjs/jwt

JWT (JSON Web Token) sign, verify, and decode helper.

## Installation

```bash
npm install @rfjs/jwt
```

## API

### `Jwt.initial(secret, options)`

Create a JWT instance with a secret and default sign options.

```typescript
import { Jwt } from '@rfjs/jwt';

const jwt = Jwt.initial('my-secret-key', { expiresIn: 3600 });
```

### `createToken(payload, options)`

Sign and create a JWT token.

```typescript
const token = jwt.createToken({ userId: 1, role: 'admin' });
```

### `decodeToken(token)`

Decode a JWT token without verification.

```typescript
const payload = jwt.decodeToken<{ userId: number }>(token);
```

### `verifyToken(token, options)`

Verify and decode a JWT token with signature validation.

```typescript
const result = jwt.verifyToken<{ userId: number }>(token);

if (result.success) {
  console.log(result.payload.userId);
} else {
  console.error(result.errMsg); // 'jwt expired', 'invalid signature', etc.
}
```

Returns `{ success: boolean, payload: T, err?, errMsg? }`.
