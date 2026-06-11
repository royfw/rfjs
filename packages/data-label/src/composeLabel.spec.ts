import { describe, it, expect } from 'vitest';
import { composeLabel } from './composeLabel';

const source = { contract: [{ type: 'ProductSales' }], qty: 3 };

describe('composeLabel', () => {
  it('interpolates aliasKey, positional, and path tokens', () => {
    expect(
      composeLabel(
        {
          fields: [{ path: 'contract[0].type', aliasKey: 'type' }, { path: 'qty' }],
          valueMap: [{ key: 'ProductSales', value: '產品銷售契約' }],
          template: '${type} x${_1}',
        },
        source,
      ),
    ).toBe('產品銷售契約 x3');
  });

  it('resolves a ${path} token by its normalized form', () => {
    expect(
      composeLabel(
        { fields: [{ path: 'contract[0].type' }], template: '<${contract[0].type}>' },
        source,
      ),
    ).toBe('<ProductSales>');
  });

  it('renders unknown tokens and nullish values as empty string', () => {
    expect(
      composeLabel({ fields: [{ path: 'missing' }], template: 'a${_0}b${nope}c' }, {}),
    ).toBe('abc');
  });

  it('space-joins field values when there is no template', () => {
    expect(
      composeLabel({ fields: [{ path: 'contract[0].type' }, { path: 'qty' }] }, source),
    ).toBe('ProductSales 3');
  });

  it('keeps 0 and false in the no-template join (drops only null/undefined/"")', () => {
    expect(
      composeLabel(
        { fields: [{ path: 'a' }, { path: 'b' }, { path: 'c' }, { path: 'd' }] },
        { a: 0, b: false, c: '', d: 'x' },
      ),
    ).toBe('0 false x');
  });

  it('uses a custom render hook when provided', () => {
    expect(
      composeLabel(
        { fields: [{ path: 'qty' }], template: 'RAW' },
        source,
        { render: (template, values) => `${template}:${String(values['_0'])}` },
      ),
    ).toBe('RAW:3');
  });
});
