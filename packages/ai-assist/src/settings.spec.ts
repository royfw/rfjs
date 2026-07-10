import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_SETTINGS_KEY,
  clearAiSettings,
  isConfigured,
  loadAiSettings,
  saveAiSettings,
  subscribeAiSettings,
} from './settings';
import type { AiStorage } from './storage';

describe('ai settings storage', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips settings through localStorage', () => {
    expect(loadAiSettings()).toBeNull();
    saveAiSettings({ baseUrl: 'http://localhost:4000/v1', apiKey: 'sk-x', model: 'gpt-test' });
    expect(loadAiSettings()).toEqual({ baseUrl: 'http://localhost:4000/v1', apiKey: 'sk-x', model: 'gpt-test' });
    expect(localStorage.getItem(AI_SETTINGS_KEY)).toBeTruthy();
    clearAiSettings();
    expect(loadAiSettings()).toBeNull();
  });

  it('isConfigured requires all three fields non-empty', () => {
    expect(isConfigured(null)).toBe(false);
    expect(isConfigured({ baseUrl: '', apiKey: 'k', model: 'm' })).toBe(false);
    expect(isConfigured({ baseUrl: 'u', apiKey: 'k', model: 'm' })).toBe(true);
  });

  it('tolerates corrupted stored json', () => {
    localStorage.setItem(AI_SETTINGS_KEY, 'not json');
    expect(loadAiSettings()).toBeNull();
  });

  it('notifies same-tab subscribers on save and clear', () => {
    const cb = vi.fn();
    const unsub = subscribeAiSettings(cb);
    saveAiSettings({ baseUrl: 'u', apiKey: 'k', model: 'm' });
    expect(cb).toHaveBeenCalledTimes(1);
    clearAiSettings();
    expect(cb).toHaveBeenCalledTimes(2);
    unsub();
    saveAiSettings({ baseUrl: 'u', apiKey: 'k', model: 'm' });
    expect(cb).toHaveBeenCalledTimes(2); // 取消訂閱後不再收到
  });

  it('uses an injected storage adapter (no window/localStorage touch)', () => {
    const map = new Map<string, string>();
    const fake: AiStorage = {
      get: (k) => map.get(k) ?? null,
      set: (k, v) => void map.set(k, v),
      remove: (k) => void map.delete(k),
    };
    saveAiSettings({ baseUrl: 'u', apiKey: 'k', model: 'm' }, fake);
    expect(map.get(AI_SETTINGS_KEY)).toBeTruthy();
    expect(loadAiSettings(fake)).toEqual({ baseUrl: 'u', apiKey: 'k', model: 'm' });
    expect(localStorage.getItem(AI_SETTINGS_KEY)).toBeNull(); // 沒碰 localStorage
    // 無 subscribe 的 adapter → 取得 no-op unsub，不拋錯
    expect(typeof subscribeAiSettings(() => {}, fake)).toBe('function');
  });
});
