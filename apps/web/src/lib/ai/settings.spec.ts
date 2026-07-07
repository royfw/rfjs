import { beforeEach, describe, expect, it } from 'vitest';

import { AI_SETTINGS_KEY, clearAiSettings, isConfigured, loadAiSettings, saveAiSettings } from './settings';

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
});
