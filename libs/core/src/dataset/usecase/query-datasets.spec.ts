import { describe, it, expect, vi } from 'vitest';
import { makeQueryDatasets } from './query-datasets';
import type { DatasetRepository } from '../repository';

function repoWith(query: ReturnType<typeof vi.fn>): DatasetRepository {
  return { list: vi.fn(), getById: vi.fn(), create: vi.fn(), query } satisfies DatasetRepository;
}

describe('makeQueryDatasets', () => {
  it('validates the body, delegates to repository.query, and echoes pagination', async () => {
    const query = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const queryDatasets = makeQueryDatasets({ repo: repoWith(query) });

    const res = await queryDatasets({
      filter: { logic: 'and', filters: [{ target: 'jsonb', field: 'region', dataType: 'string', operator: 'eq', value: 'apac' }] },
    });

    expect(res).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(query).toHaveBeenCalledTimes(1);
    const arg = query.mock.calls[0][0];
    expect(arg.page).toBe(1);
    expect(arg.pageSize).toBe(20);
  });

  it('throws on an invalid body without calling the repository', async () => {
    const query = vi.fn();
    const queryDatasets = makeQueryDatasets({ repo: repoWith(query) });
    await expect(queryDatasets({ filter: { logic: 'xor', filters: [] } })).rejects.toThrow();
    await expect(queryDatasets({ pageSize: 999 })).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });
});
