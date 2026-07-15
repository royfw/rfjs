import { describe, it, expect } from 'vitest';
import { resolveLabel } from './localized-label';

describe('resolveLabel', () => {
  it('returns a plain string as-is', () => {
    expect(resolveLabel('Name', 'zh-TW')).toBe('Name');
  });
  it('returns the locale entry from a record', () => {
    expect(resolveLabel({ en: 'Name', 'zh-TW': '姓名' }, 'zh-TW')).toBe('姓名');
  });
  it('falls back to fallbackLocale, then to the first value', () => {
    expect(resolveLabel({ en: 'Name' }, 'zh-TW', 'en')).toBe('Name');
    expect(resolveLabel({ ja: '名前' }, 'zh-TW')).toBe('名前');
  });
  it('returns empty string for an empty record', () => {
    expect(resolveLabel({}, 'en')).toBe('');
  });
});
