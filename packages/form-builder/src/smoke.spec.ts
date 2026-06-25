import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@rfjs/form-builder', () => {
  it('exposes its package name', () => {
    expect(PACKAGE_NAME).toBe('@rfjs/form-builder');
  });
});
