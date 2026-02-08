import { describe, it, expect } from 'vitest';
import DemoUtils from '@/utils/demo.utils';

describe('DemoUtils', () => {
  it('should return the correct value', () => {
    expect(DemoUtils.getDemoValue()).toBe('demo');
  });
});
