import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_SETTINGS_KEY,
  clearAiSettings,
  isConfigured,
  loadAiSettings,
  saveAiSettings,
  subscribeAiSettings,
} from './settings';

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
});
