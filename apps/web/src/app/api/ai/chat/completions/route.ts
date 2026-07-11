import { createAiProxyHandler } from "@rfjs/ai-assist";

// Reference server-proxy handler. The public showcase keeps using browser BYOK;
// this route stays disabled (501) unless AI_PROXY_* env is configured, and exists
// to demonstrate / enable the server-proxy mode (key held server-side, never in the
// browser). Wire a gate (auth / rate-limit) before enabling on a public deployment.
const handler = createAiProxyHandler({
  getServerSettings: () => {
    const baseUrl = process.env.AI_PROXY_BASE_URL;
    const apiKey = process.env.AI_PROXY_API_KEY;
    const model = process.env.AI_PROXY_MODEL;
    if (!baseUrl || !apiKey || !model) return null; // not configured → 501
    return { baseUrl, apiKey, model };
  },
});

export const POST = (req: Request): Promise<Response> => handler(req);
