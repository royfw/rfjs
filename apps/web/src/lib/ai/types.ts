/** BYOK 連線設定 —— 只存 localStorage,只在瀏覽器使用。 */
export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type AiErrorKind = 'config' | 'http' | 'timeout' | 'abort' | 'parse';

export class AiError extends Error {
  constructor(
    public readonly kind: AiErrorKind,
    message: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

export interface CompleteRequest {
  system: string;
  user: string;
  /** true → 要求 JSON 回應(response_format: json_object)。 */
  json?: boolean;
  signal?: AbortSignal;
  /** 預設 60_000ms。 */
  timeoutMs?: number;
}

/** 單發完成介面;未來長文場景再加 stream()(刻意不先宣告)。 */
export interface AiClient {
  complete(req: CompleteRequest): Promise<string>;
}
