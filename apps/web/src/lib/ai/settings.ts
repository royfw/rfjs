import type { AiSettings } from './types';

export const AI_SETTINGS_KEY = 'rfjs.ai.settings';

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
  window.localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(s));
}

export function clearAiSettings(): void {
  window.localStorage.removeItem(AI_SETTINGS_KEY);
}

export function isConfigured(s: AiSettings | null): s is AiSettings {
  return !!s && s.baseUrl.trim() !== '' && s.apiKey.trim() !== '' && s.model.trim() !== '';
}
