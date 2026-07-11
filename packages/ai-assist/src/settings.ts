import type { AiSettings } from "./types";
import { type AiStorage, createBrowserStorage } from "./storage";

export const AI_SETTINGS_KEY = "rfjs.ai.settings";

export function loadAiSettings(
  storage: AiStorage = createBrowserStorage(),
): AiSettings | null {
  const raw = storage.get(AI_SETTINGS_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AiSettings>;
    if (
      typeof v.baseUrl === "string" &&
      typeof v.apiKey === "string" &&
      typeof v.model === "string"
    ) {
      return { baseUrl: v.baseUrl, apiKey: v.apiKey, model: v.model };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiSettings(
  s: AiSettings,
  storage: AiStorage = createBrowserStorage(),
): void {
  storage.set(AI_SETTINGS_KEY, JSON.stringify(s));
}

export function clearAiSettings(
  storage: AiStorage = createBrowserStorage(),
): void {
  storage.remove(AI_SETTINGS_KEY);
}

export function isConfigured(s: AiSettings | null): s is AiSettings {
  return (
    !!s &&
    s.baseUrl.trim() !== "" &&
    s.apiKey.trim() !== "" &&
    s.model.trim() !== ""
  );
}

/** 訂閱設定變更：同分頁自訂事件 + 跨分頁 storage 事件（委派給 storage.subscribe）。回傳取消訂閱。 */
export function subscribeAiSettings(
  callback: () => void,
  storage: AiStorage = createBrowserStorage(),
): () => void {
  return storage.subscribe?.(callback) ?? (() => {});
}
