import { describe, it, expect } from 'vitest';
import { buildLabelValues } from './buildLabelValues';

describe('buildLabelValues', () => {
  it('stores each value under positional, raw-path, normalized-path, and aliasKey keys', () => {
    const values = buildLabelValues(
      { fields: [{ path: 'contract[0]', aliasKey: 'c0' }] },
      { contract: ['X'] },
    );
    expect(values['_0']).toBe('X');
    expect(values['contract[0]']).toBe('X');
    expect(values['contract0']).toBe('X');
    expect(values['c0']).toBe('X');
  });

  it('translates a resolved value via valueMap, passing through unmatched values', () => {
    const values = buildLabelValues(
      {
        fields: [{ path: 'type' }, { path: 'other' }],
        valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
      },
      { type: 'ProductSales', other: 'keep' },
    );
    expect(values['_0']).toBe('產品銷售契約');
    expect(values['_1']).toBe('keep');
  });

  it('keeps a falsy mapped value (uses has(), not ??)', () => {
    const values = buildLabelValues(
      { fields: [{ path: 'flag' }], valueMap: [{ key: true, value: '' }] },
      { flag: true },
    );
    expect(values['_0']).toBe('');
  });

  it('resolves a missing path to null', () => {
    const values = buildLabelValues({ fields: [{ path: 'nope' }] }, {});
    expect(values['_0']).toBeNull();
  });
});
