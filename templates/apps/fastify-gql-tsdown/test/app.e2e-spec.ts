import { describe, it, expect } from 'vitest';
import { getDemoValue } from '@/utils';

describe('Main e2e', () => {
  it('should be true', () => {
    expect(true).toBe(true);
  });

  it('should be return data', () => {
    const result = getDemoValue();
    expect(result).toBe('demo');
  });
});
