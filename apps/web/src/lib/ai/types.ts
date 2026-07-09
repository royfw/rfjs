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

/** 串流增量:content=回覆 token;reasoning=推理 token(r1 類模型經 litellm 透傳 reasoning_content)。 */
export interface StreamDelta {
  content?: string;
  reasoning?: string;
}

/** 單發完成 + 串流。串流僅用於 display-only 純文字(問答/解釋);產生類仍走 complete(需完整 JSON 過閘門)。 */
export interface AiClient {
  complete(req: CompleteRequest): Promise<string>;
  /** SSE 串流;每個增量呼叫 onDelta,回傳累積的完整 content(與 complete 等價)。 */
  stream(req: CompleteRequest, onDelta: (d: StreamDelta) => void): Promise<string>;
}
