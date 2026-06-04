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
});
