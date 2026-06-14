import { describe, it, expect, vi } from 'vitest';
import { makeGetDataset } from './get-dataset';
import type { DatasetRepository } from '../repository';

describe('makeGetDataset', () => {
  it('delegates to repository.getById', async () => {
    const repo = { list: vi.fn(), getById: vi.fn().mockResolvedValue(undefined), create: vi.fn() } satisfies DatasetRepository;
    const getDataset = makeGetDataset({ repo });
    expect(await getDataset('abc')).toBeUndefined();
    expect(repo.getById).toHaveBeenCalledWith('abc');
  });
});
