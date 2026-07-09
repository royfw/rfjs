import { describe, expect, it } from 'vitest';
import { parseDataResourceMeta } from './schema';

const field = (over: object = {}) => ({ key: 'name', label: 'Name', dataType: 'string', ...over });

describe('parseDataResourceMeta', () => {
  it('accepts a minimal fields-only meta', () => {
    expect(() => parseDataResourceMeta({ fields: [field()] })).not.toThrow();
  });

  it('accepts a full remote meta (all three pagination strategies)', () => {
    const paginations = [
      { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
      { strategy: 'page', pageParam: 'page', pageSizeParam: 'size', firstPage: 0 },
      { strategy: 'cursor', cursorParam: 'cursor', limitParam: 'limit' },
    ];
    for (const pagination of paginations) {
      expect(() => parseDataResourceMeta({
        fields: [field({ dataType: 'numeric', format: 'currency', sortable: true })],
        request: { endpoint: '/api/items', pagination, sort: { style: 'single', param: 'sort', encoding: 'colon' } },
        response: { rowsPath: 'data.items', totalPath: 'data.total' },
      })).not.toThrow();
    }
  });

  it('rejects format incompatible with dataType', () => {
    expect(() => parseDataResourceMeta({ fields: [field({ dataType: 'string', format: 'currency' })] })).toThrow();
    expect(() => parseDataResourceMeta({ fields: [field({ dataType: 'numeric', format: 'datetime' })] })).toThrow();
    expect(() => parseDataResourceMeta({ fields: [field({ dataType: 'boolean', format: 'integer' })] })).toThrow();
  });

  it('rejects unknown pagination strategy and empty field key', () => {
    expect(() => parseDataResourceMeta({ fields: [field({ key: '' })] })).toThrow();
    expect(() => parseDataResourceMeta({
      fields: [field()],
      request: { endpoint: '/x', pagination: { strategy: 'scroll' } },
    })).toThrow();
  });
});
