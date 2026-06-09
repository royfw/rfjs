import { describe, it, expect } from 'vitest';
import { aliasValue, buildAliasLookup } from './aliasValue';

describe('aliasValue', () => {
  it('resolves a flat ${name} placeholder', () => {
    expect(aliasValue('${name}', { name: 'Alice' })).toBe('Alice');
  });
  it('resolves a nested ${user.name} placeholder', () => {
    expect(aliasValue('${user.name}', { user: { name: 'Bob' } })).toBe('Bob');
  });
  it('resolves the $name short form', () => {
    expect(aliasValue('$age', { age: 30 })).toBe(30);
  });
  it('returns undefined when the key is missing', () => {
    expect(aliasValue('${missing}', { a: 1 })).toBeUndefined();
  });
  it('precomputed lookup yields the same result as the default path', () => {
    const source = { user: { name: 'Carol' } };
    const lookup = buildAliasLookup(source);
    const withLookup = aliasValue('${user.name}', source, lookup);
    const withoutLookup = aliasValue('${user.name}', source);
    expect(withLookup).toBe('Carol');
    expect(withLookup).toBe(withoutLookup);
  });
});
