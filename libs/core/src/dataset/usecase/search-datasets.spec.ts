import { describe, it, expect, vi } from 'vitest';
import { makeSearchDatasets } from './search-datasets';
import type { DatasetRepository } from '../repository';

const validBody = {
  filter: {
    logic: 'and',
    filters: [{ field: 'region', dataType: 'string', operator: 'eq', value: 'apac' }],
  },
};

describe('makeSearchDatasets', () => {
  it('validates the body then delegates the filter to repository.search', async () => {
    const repo = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
    } satisfies DatasetRepository;
    const searchDatasets = makeSearchDatasets({ repo });
    await searchDatasets(validBody);
    expect(repo.search).toHaveBeenCalledWith(validBody.filter);
  });

  it('throws on an invalid body shape without calling the repository', async () => {
    const repo = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      search: vi.fn(),
    } satisfies DatasetRepository;
    const searchDatasets = makeSearchDatasets({ repo });
    await expect(searchDatasets({ filter: { logic: 'xor', filters: [] } })).rejects.toThrow();
    await expect(searchDatasets({})).rejects.toThrow();
    expect(repo.search).not.toHaveBeenCalled();
  });
});
