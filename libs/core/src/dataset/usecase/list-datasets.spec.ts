import { describe, it, expect, vi } from 'vitest';
import { makeListDatasets } from './list-datasets';
import type { DatasetRepository } from '../repository';

describe('makeListDatasets', () => {
  it('returns whatever the repository lists', async () => {
    const repo = { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), create: vi.fn(), query: vi.fn() } satisfies DatasetRepository;
    const listDatasets = makeListDatasets({ repo });
    expect(await listDatasets()).toEqual([]);
    expect(repo.list).toHaveBeenCalledOnce();
  });
});
