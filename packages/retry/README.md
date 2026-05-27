# @rfjs/retry

Retry helper with configurable delay and max attempts.

## Installation

```bash
npm install @rfjs/retry
```

## API

### `retry(job, periodMs, maxRetryTimes)`

Retry an async or sync function on failure.

```typescript
import { retry } from '@rfjs/retry';

async function fetchData() {
  // may throw
}

const result = await retry(fetchData, 100, 5);
// periodMs: 100ms (default), maxRetryTimes: 5 (default)
```

### `RetryHelper.createRetry()`

Create a bound retry instance from a helper class.

```typescript
import { RetryHelper } from '@rfjs/retry';

const helper = new RetryHelper();
const retryFn = helper.createRetry();
const result = await retryFn(fetchData, 200, 3);
```

### `delay(ms)`

Pause execution for a specified number of milliseconds.

```typescript
import { delay } from '@rfjs/retry';

await delay(1000); // wait 1 second
```
