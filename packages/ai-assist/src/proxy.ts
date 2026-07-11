import type { AiSettings } from './types';

export interface AiProxyOptions {
  /** 由呼叫端提供 server 端連線設定（通常讀 env / secret）。回 null → 停用（501）。 */
  getServerSettings: (req: Request) => Promise<AiSettings | null> | AiSettings | null;
}

/** framework-agnostic 透明代理：吃標準 Request、以 server 端 key + model 轉發至 gateway、原樣回傳
 *  （含 SSE 串流 body passthrough）。掛進 Next route handler / Fastify / 任何 fetch-style 後端即成 proxy。
 *  前端 client 走 proxy 時以 noAuth 打 /api/ai，body 為標準 OpenAI 形狀；此處覆寫 model 為 server 設定。 */
export function createAiProxyHandler(
  opts: AiProxyOptions,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const settings = await opts.getServerSettings(req);
    if (!settings) {
      return new Response(JSON.stringify({ error: 'ai proxy not configured' }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      });
    }
    // Reference handler: a malformed body falls through as {} (server model still injected).
    // Validate and 400 before enabling in production.
    const clientBody = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const upstreamBody = { ...clientBody, model: settings.model }; // server model wins
    const upstream = await fetch(
      `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(upstreamBody),
      },
    );
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  };
}
