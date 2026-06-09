import { describe, it, expect } from 'vitest';
import { matchAndMap } from './matchAndMap';
import type { FilterMappingMetadata } from './matchAndMap';

describe('matchAndMap', () => {
  const metadatas: FilterMappingMetadata[] = [
    {
      filter: {
        logic: 'and',
        filters: [
          {
            field: 'data.name',
            dataType: 'string',
            operator: 'eq',
            value: 'alice',
          },
        ],
      },
      mappings: [{ key: 'tag', type: 'value', value: 'new' }],
    },
  ];

  it('applies the mapping to the matched result', () => {
    const filterData = [{ name: 'alice', tag: 'old' }];
    const result = matchAndMap<{ name: string; tag: string }>(
      filterData,
      metadatas,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: 'alice', tag: 'new' });
  });

  it('does not mutate the caller input objects', () => {
    const filterData = [{ name: 'alice', tag: 'old' }];
    matchAndMap(filterData, metadatas);
    expect(filterData[0]).toEqual({ name: 'alice', tag: 'old' });
  });

  it('dedupes a row matched by multiple metadata (last mapping wins)', () => {
    const filterData = [{ name: 'alice', tag: 'old' }];
    const metas: FilterMappingMetadata[] = [
      {
        filter: {
          logic: 'and',
          filters: [
            { field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' },
          ],
        },
        mappings: [{ key: 'tag', type: 'value', value: 'first' }],
      },
      {
        filter: {
          logic: 'and',
          filters: [
            { field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' },
          ],
        },
        mappings: [{ key: 'tag', type: 'value', value: 'second' }],
      },
    ];
    const result = matchAndMap<{ name: string; tag: string }>(filterData, metas);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('second');
  });

  it('keeps a row matched by only one metadata (a later non-match does not evict it)', () => {
    const filterData = [{ name: 'alice', tag: 'old' }];
    const metas: FilterMappingMetadata[] = [
      {
        filter: {
          logic: 'and',
          filters: [
            { field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' },
          ],
        },
        mappings: [{ key: 'tag', type: 'value', value: 'matched' }],
      },
      {
        filter: {
          logic: 'and',
          filters: [
            { field: 'data.name', dataType: 'string', operator: 'eq', value: 'nobody' },
          ],
        },
        mappings: [{ key: 'tag', type: 'value', value: 'unmatched' }],
      },
    ];
    const result = matchAndMap<{ name: string; tag: string }>(filterData, metas);
    expect(result).toHaveLength(1);
    expect(result[0].tag).toBe('matched');
  });
});
