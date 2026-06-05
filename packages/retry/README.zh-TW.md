# @rfjs/retry

具備可設定延遲時間與最大重試次數的重試工具。

## 安裝

```bash
npm install @rfjs/retry
```

## 使用方式

### `retry(job, periodMs, maxRetryTimes)`

失敗時自動重試非同步或同步函式。

```typescript
import { retry } from '@rfjs/retry';

async function fetchData() {
  // 可能會丟出例外
}

const result = await retry(fetchData, 100, 5);
// periodMs: 100ms（預設值），maxRetryTimes: 5（預設值）
```

### `RetryHelper`

透過輔助類別建立綁定的重試實例。

```typescript
import { RetryHelper } from '@rfjs/retry';

const helper = new RetryHelper();
const retryFn = helper.createRetry();
const result = await retryFn(fetchData, 200, 3);
```

### `delay(ms)`

暫停執行指定的毫秒數。

```typescript
import { delay } from '@rfjs/retry';

await delay(1000); // 等待 1 秒
```
