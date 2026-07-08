import { AiError, type AiClient, type AiSettings, type CompleteRequest } from './types';
import { isConfigured } from './settings';

const DEFAULT_TIMEOUT_MS = 60_000;
const MODELS_TIMEOUT_MS = 15_000;

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
    const res = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: settings.apiKey.trim() ? { Authorization: `Bearer ${settings.apiKey}` } : {},
      signal: ctl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new AiError('http', `models request returned ${res.status}`, text.slice(0, 500));
    }
    const data = (await res.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
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

/** OpenAI-compatible 單發 chat completion(litellm / Ollama / OpenAI 通用)。 */
export function createAiClient(settings: AiSettings): AiClient {
  return {
    async complete(req: CompleteRequest): Promise<string> {
      if (!isConfigured(settings)) {
        throw new AiError('config', 'AI connection is not configured');
      }
      const ctl = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        ctl.abort();
      }, req.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const onExternalAbort = () => ctl.abort();
      req.signal?.addEventListener('abort', onExternalAbort, { once: true });

      try {
        const res = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model,
            messages: [
              { role: 'system', content: req.system },
              { role: 'user', content: req.user },
            ],
            ...(req.json ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: ctl.signal,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new AiError('http', `AI endpoint returned ${res.status}`, text.slice(0, 500));
        }
        const data = (await res.json().catch(() => null)) as
          | { choices?: { message?: { content?: unknown } }[] }
          | null;
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new AiError('parse', 'unexpected completion payload shape');
        }
        return content;
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
    },
  };
}
