import { describe, it, expect } from 'vitest';
import { CreateDatasetInputSchema } from './schema';

describe('CreateDatasetInputSchema', () => {
  it('accepts a valid input and defaults data to {}', () => {
    const parsed = CreateDatasetInputSchema.parse({ name: 'X' });
    expect(parsed).toEqual({ name: 'X', description: undefined, data: {} });
  });

  it('rejects an empty name', () => {
    expect(() => CreateDatasetInputSchema.parse({ name: '' })).toThrow();
  });
});
