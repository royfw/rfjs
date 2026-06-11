import { describe, it, expect } from 'vitest';
import { matchAndMapAsync } from './matchAndMapAsync';
import type { FilterMappingMetadata } from './matchAndMap';

const aliceFilter: FilterMappingMetadata['filter'] = {
  logic: 'and',
  filters: [{ field: 'data.name', dataType: 'string', operator: 'eq', value: 'alice' }],
};

describe('matchAndMapAsync', () => {
  it('computes an "=" mapping value (the BPM times case)', async () => {
    const result = await matchAndMapAsync<{ name: string; bonus: number }>(
      [{ name: 'alice', qty: 3 }],
      [{ filter: aliceFilter, mappings: [{ key: 'bonus', type: 'value', value: '=500 * data.qty' }] }],
    );
    expect(result).toHaveLength(1);
    expect(result[0].bonus).toBe(1500);
  });
  it('computes aggregates over the row', async () => {
    const result = await matchAndMapAsync<{ name: string; total: number }>(
      [{ name: 'alice', items: [{ amount: 100 }, { amount: 250 }] }],
      [{ filter: aliceFilter, mappings: [{ key: 'total', type: 'value', value: '=$sum(data.items.amount) * 2' }] }],
    );
    expect(result[0].total).toBe(700);
  });
  it('plain literal mappings and legacy ${} aliases still work', async () => {
    const result = await matchAndMapAsync<{ name: string; tag: string; copy: unknown }>(
      [{ name: 'alice', qty: 9 }],
      [{ filter: aliceFilter, mappings: [
        { key: 'tag', type: 'value', value: 'fixed' },
        { key: 'copy', type: 'value', value: '${data.qty}' },
      ] }],
    );
    expect(result[0].tag).toBe('fixed');
    expect(result[0].copy).toBe(9);
  });
  it('supports an "=" slot inside the FILTER too', async () => {
    const result = await matchAndMapAsync<{ name: string }>(
      [
        { name: 'a', items: [{ amount: 900 }, { amount: 200 }] },
        { name: 'b', items: [{ amount: 1 }] },
      ],
      [{ filter: {
        logic: 'and',
        filters: [{ field: '=$sum(data.items.amount)', dataType: 'numeric', operator: 'gt', value: 1000 } as never],
      } }],
    );
    expect(result.map((r) => r.name)).toEqual(['a']);
  });
  it('does not mutate caller input and dedupes by source row', async () => {
    const input = [{ name: 'alice', qty: 1 }];
    const result = await matchAndMapAsync(
      input,
      [
        { filter: aliceFilter, mappings: [{ key: 'bonus', type: 'value', value: '=1 * data.qty' }] },
        { filter: aliceFilter, mappings: [{ key: 'bonus', type: 'value', value: '=2 * data.qty' }] },
      ],
    );
    expect(input[0]).toEqual({ name: 'alice', qty: 1 });
    expect(result).toHaveLength(1);
    expect((result[0] as { bonus: number }).bonus).toBe(2); // last mapping wins
  });
});
