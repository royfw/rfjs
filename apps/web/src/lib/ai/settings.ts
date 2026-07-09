import type { AiSettings } from './types';

export const AI_SETTINGS_KEY = 'rfjs.ai.settings';
/** 同分頁存/清設定時派送(storage 事件只跨分頁,同分頁不觸發)。 */
const AI_SETTINGS_EVENT = 'rfjs:ai-settings';

export function loadAiSettings(): AiSettings | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AI_SETTINGS_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AiSettings>;
    if (typeof v.baseUrl === 'string' && typeof v.apiKey === 'string' && typeof v.model === 'string') {
      return { baseUrl: v.baseUrl, apiKey: v.apiKey, model: v.model };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiSettings(s: AiSettings): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
}

export function clearAiSettings(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AI_SETTINGS_KEY);
  window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
}

export function isConfigured(s: AiSettings | null): s is AiSettings {
  return !!s && s.baseUrl.trim() !== '' && s.apiKey.trim() !== '' && s.model.trim() !== '';
}

/** 訂閱設定變更:同分頁自訂事件 + 跨分頁 storage 事件。回傳取消訂閱。 */
export function subscribeAiSettings(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === AI_SETTINGS_KEY || e.key === null) callback();
  };
  window.addEventListener(AI_SETTINGS_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(AI_SETTINGS_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}
