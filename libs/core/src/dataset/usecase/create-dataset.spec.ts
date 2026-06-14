import { describe, it, expect, vi } from 'vitest';
import { makeCreateDataset } from './create-dataset';
import type { DatasetRepository } from '../repository';
import type { Dataset } from '../schema';

const fakeDataset: Dataset = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'X',
  description: null,
  data: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('makeCreateDataset', () => {
  it('validates input then delegates to repository.create', async () => {
    const repo: DatasetRepository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn().mockResolvedValue(fakeDataset),
    };
    const createDataset = makeCreateDataset({ repo });
    const result = await createDataset({ name: 'X' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'X', description: undefined, data: {} });
    expect(result).toBe(fakeDataset);
  });

  it('throws on invalid input without calling the repository', async () => {
    const repo: DatasetRepository = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
    };
    const createDataset = makeCreateDataset({ repo });
    await expect(createDataset({ name: '' })).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });
});
