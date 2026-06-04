import { describe, it, expect } from 'vitest';
import { aliasData } from './aliasData';

describe('aliasData', () => {
  it('resolves ${...} placeholders against the source', () => {
    const result = aliasData<{ greeting: string }>(
      { greeting: '${name}' },
      { name: 'alice' },
    );
    expect(result.greeting).toBe('alice');
  });

  it('does not mutate the caller input object', () => {
    const input = { greeting: '${name}' };
    aliasData(input, { name: 'alice' });
    expect(input.greeting).toBe('${name}');
  });

  it('returns a new object rather than the same reference', () => {
    const input = { greeting: '${name}' };
    const result = aliasData(input, { name: 'alice' });
    expect(result).not.toBe(input);
  });
});
