# @rfjs/jwt

JWT（JSON Web Token）簽署、驗證、解碼工具。

## 安裝

```bash
npm install @rfjs/jwt
```

## 使用方式

### `Jwt.initial(secret, options)`

使用金鑰與預設簽署選項建立 JWT 實例。

```typescript
import { Jwt } from '@rfjs/jwt';

const jwt = Jwt.initial('my-secret-key', { expiresIn: 3600 });
```

### `createToken(payload, options)`

簽署並建立 JWT Token。

```typescript
const token = jwt.createToken({ userId: 1, role: 'admin' });
```

### `decodeToken(token)`

不解密驗證，直接解碼 JWT Token。

```typescript
const payload = jwt.decodeToken<{ userId: number }>(token);
```

### `verifyToken(token, options)`

驗證並解碼 JWT Token，包含簽章驗證。

```typescript
const result = jwt.verifyToken<{ userId: number }>(token);

if (result.success) {
  console.log(result.payload.userId);
} else {
  console.error(result.errMsg); // 'jwt expired', 'invalid signature' 等
}
```

回傳格式：`{ success: boolean, payload: T, err?, errMsg? }`

### 錯誤訊息

| 錯誤 | 訊息 |
|------|------|
| Token 過期 | `jwt expired` |
| 簽章無效 | `invalid signature` |
| 尚未生效 | `jwt not active` |
| Token 格式無效 | `invalid token` |
