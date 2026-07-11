/** 認證策略 —— 貢獻要附加到請求的 header。抽象讓 client 一次涵蓋 BYOK / 無 key / proxy / 未來 OAuth。 */
export interface AuthStrategy {
  readonly kind: "apiKey" | "oauth" | "none";
  authHeaders(): Promise<Record<string, string>>;
}

/** BYOK：送 `Authorization: Bearer <key>`（空 key 仍送 `Bearer `，保留既有行為）。 */
export function apiKeyAuth(apiKey: string): AuthStrategy {
  return {
    kind: "apiKey",
    authHeaders: async () => ({ Authorization: `Bearer ${apiKey}` }),
  };
}

/** 不附任何憑證 —— proxy 的瀏覽器端（靠同源 cookie）或 keyless 本機端點。 */
export function noAuth(): AuthStrategy {
  return {
    kind: "none",
    authHeaders: async () => ({}),
  };
}

/** 未來 "Sign in with Claude/ChatGPT" OAuth 的設定形狀 —— 本 wave 僅預留型別，不實作 `oauthAuth`。 */
export interface OAuthStrategyConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes?: string[];
}
