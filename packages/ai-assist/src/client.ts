import {
  AiError,
  type AiClient,
  type AiSettings,
  type CompleteRequest,
  type StreamDelta,
} from './types';
import { apiKeyAuth, type AuthStrategy } from './auth';
import { isConfigured } from './settings';

const DEFAULT_TIMEOUT_MS = 60_000;
const MODELS_TIMEOUT_MS = 15_000;
const DEFAULT_BASE_DELAY_MS = 500;

/** opt-in 傳輸重試。預設 maxRetries:0 → 完全等於今天的行為。 */
export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs?: number;
  respectRetryAfter?: boolean;
}

/** 一般化的 client 設定:baseUrl + auth(取代寫死 apiKey),可選 retry。 */
export interface AiClientConfig {
  baseUrl: string;
  model: string;
  auth: AuthStrategy;
  retry?: RetryPolicy;
}

const stripTrailingSlash = (u: string) => u.replace(/\/+$/, '');

/** 列出端點可用模型(GET {baseUrl}/models,OpenAI-compatible)。
 * 只要求 baseUrl —— apiKey 可留空(如 Ollama),有值才帶 Bearer。 */
export async function listAiModels(
  settings: Pick<AiSettings, 'baseUrl' | 'apiKey'>,
): Promise<string[]> {
  if (settings.baseUrl.trim() === '') {
    throw new AiError('config', 'base URL is required');
  }
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, MODELS_TIMEOUT_MS);
  try {
    const res = await fetch(`${stripTrailingSlash(settings.baseUrl)}/models`, {
      headers: settings.apiKey.trim()
        ? { Authorization: `Bearer ${settings.apiKey}` }
        : {},
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AiError(
        'http',
        `models request returned ${res.status}`,
        text.slice(0, 500),
      );
    }
    const data = (await res.json().catch(() => null)) as {
      data?: { id?: unknown }[];
    } | null;
    if (!data || !Array.isArray(data.data)) {
      throw new AiError('parse', 'unexpected models payload shape');
    }
    return data.data
      .map((m) => m?.id)
      .filter((id): id is string => typeof id === 'string')
      .sort();
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw timedOut
        ? new AiError('timeout', 'models request timed out')
        : new AiError('abort', 'models request cancelled');
    }
    throw new AiError('http', e instanceof Error ? e.message : String(e));
  } finally {
    clearTimeout(timer);
  }
}

function isRetryable(e: AiError): boolean {
  if (e.kind === 'timeout') return true;
  if (e.kind === 'http' && typeof e.status === 'number')
    return e.status === 429 || e.status >= 500;
  return false;
}

function parseRetryAfterMs(res: Response): number | undefined {
  const h = res.headers.get('retry-after');
  if (!h) return undefined;
  const secs = Number(h);
  return Number.isFinite(secs) ? secs * 1000 : undefined;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    if (signal?.aborted) return done();
    signal?.addEventListener('abort', done, { once: true });
  });
}

export function createAiClient(settings: AiSettings): AiClient;
export function createAiClient(config: AiClientConfig): AiClient;
export function createAiClient(arg: AiSettings | AiClientConfig): AiClient {
  const fromSettings = !('auth' in arg);
  const config: AiClientConfig = fromSettings
    ? {
        baseUrl: (arg as AiSettings).baseUrl,
        model: (arg as AiSettings).model,
        auth: apiKeyAuth((arg as AiSettings).apiKey),
      }
    : (arg as AiClientConfig);
  const retry = config.retry;

  // BYOK(settings) 保留既有嚴格閘門(三欄皆需);typed config 只要求 baseUrl(proxy 的 model 由 server 決定)。
  const guard = () => {
    if (fromSettings) {
      if (!isConfigured(arg as AiSettings))
        throw new AiError('config', 'AI connection is not configured');
    } else if (config.baseUrl.trim() === '') {
      throw new AiError('config', 'AI connection is not configured');
    }
  };

  // 一次「嘗試」=設定 controller/timer/外部 abort 橋接 → fetch → 消費 body(json 或 SSE 迴圈),
  // 全部包在同一個 try/finally。關鍵:finally 只在 body 消費完成或出錯後才 clearTimeout + 移除 abort 監聽,
  // 因此 timeout 與 cancel 在「整個 stream 讀取期間」都持續有效(=今天 client.ts 的行為,不可回歸)。
  // 整個 attempt 由 withRetry 包起——每次重試都會 arm 一組全新的 controller/timer。
  const attempt = async (
    req: CompleteRequest,
    stream: boolean,
    onDelta?: (d: StreamDelta) => void,
  ): Promise<string> => {
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onExternalAbort = () => ctl.abort();
    req.signal?.addEventListener('abort', onExternalAbort, { once: true });
    try {
      // withRetry re-invokes attempt() after a backoff sleep; an external abort landing DURING that
      // sleep fires on req.signal before the next attempt's {once:true} listener attaches, so it
      // would be dropped. Re-check the (persistent) req.signal at the top of each attempt so a
      // during-backoff cancel is honored — inside the try so the catch classifies it as 'abort'.
      if (req.signal?.aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(await config.auth.authHeaders()),
      };
      // auth.authHeaders() is async (future OAuth token refresh) so it yields a microtask before
      // fetch() is ever called; an abort/timeout that lands in that gap sets ctl.signal but never
      // reaches a listener that hasn't been registered yet (real fetch handles a pre-aborted signal
      // itself — this guard makes that case explicit instead of depending on fetch()'s own check).
      if (ctl.signal.aborted) {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      const res = await fetch(`${stripTrailingSlash(config.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          ...(stream ? { stream: true } : {}),
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new AiError(
          'http',
          `AI endpoint returned ${res.status}`,
          text.slice(0, 500),
          res.status,
          parseRetryAfterMs(res),
        );
      }
      if (!stream) {
        const data = (await res.json().catch(() => null)) as {
          choices?: { message?: { content?: unknown } }[];
        } | null;
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string')
          throw new AiError('parse', 'unexpected completion payload shape');
        return content;
      }
      if (!res.body) throw new AiError('parse', 'response has no stream body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      // SSE:每筆事件為 `data: {...}` 行,以 [DONE] 收尾;逐行解析 delta。
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '' || data === '[DONE]') continue;
          try {
            const json = JSON.parse(data) as {
              choices?: {
                delta?: {
                  content?: unknown;
                  reasoning_content?: unknown;
                  reasoning?: unknown;
                };
              }[];
            };
            const delta = json.choices?.[0]?.delta;
            const content =
              typeof delta?.content === 'string' ? delta.content : undefined;
            const reasoning =
              typeof delta?.reasoning_content === 'string'
                ? delta.reasoning_content
                : typeof delta?.reasoning === 'string'
                  ? delta.reasoning
                  : undefined;
            if (content) full += content;
            if (content || reasoning) onDelta?.({ content, reasoning });
          } catch {
            /* 忽略單筆壞掉的 chunk,續讀 */
          }
        }
      }
      return full;
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof Error && e.name === 'AbortError') {
        throw timedOut
          ? new AiError('timeout', 'AI request timed out')
          : new AiError('abort', 'AI request cancelled');
      }
      throw new AiError('http', e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', onExternalAbort);
    }
  };

  // 預設 maxRetries:0 → 只跑一次、first error 即拋 → 與今天行為等價。(迴圈變數用 n,避免遮蔽上面的 attempt。)
  const withRetry = async <T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    const max = retry?.maxRetries ?? 0;
    const base = retry?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    for (let n = 0; ; n++) {
      try {
        return await fn();
      } catch (e) {
        if (!(e instanceof AiError) || n >= max || !isRetryable(e)) throw e;
        const ra = retry?.respectRetryAfter === false ? undefined : e.retryAfterMs;
        await sleep(ra ?? base * 2 ** n, signal);
      }
    }
  };

  return {
    async complete(req: CompleteRequest): Promise<string> {
      guard();
      return withRetry(() => attempt(req, false), req.signal);
    },

    async stream(
      req: CompleteRequest,
      onDelta: (d: StreamDelta) => void,
    ): Promise<string> {
      guard();
      return withRetry(() => attempt(req, true, onDelta), req.signal);
    },
  };
}
