import { describe, it, expect } from 'vitest';
import DemoUtils from '@/utils/demo.utils';

describe('Main e2e', () => {
  it('should be true', () => {
    expect(true).toBe(true);
  });

  it('should be return data', () => {
    const result = DemoUtils.getDemoValue();
    expect(result).toBe('demo');
  });
});
