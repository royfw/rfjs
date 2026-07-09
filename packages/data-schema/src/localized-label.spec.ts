import { describe, expect, it } from 'vitest';
import { resolveLabel } from './localized-label';

describe('resolveLabel', () => {
  it('returns a plain string directly', () => {
    expect(resolveLabel('Name', 'en')).toBe('Name');
  });

  it('returns the value for the requested locale', () => {
    expect(resolveLabel({ en: 'Name', 'zh-TW': '名稱' }, 'zh-TW')).toBe('名稱');
  });

  it('falls back to fallbackLocale when locale is missing', () => {
    expect(resolveLabel({ en: 'Name', 'zh-TW': '名稱' }, 'ja', 'en')).toBe('Name');
  });

  it('falls back to the first value when both locale and fallbackLocale are missing', () => {
    expect(resolveLabel({ en: 'Name', 'zh-TW': '名稱' }, 'ja', 'fr')).toBe('Name');
  });

  it('returns an empty string for an empty record', () => {
    expect(resolveLabel({}, 'en')).toBe('');
  });
});
