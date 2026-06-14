import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';

export const makeGetDataset =
  (deps: { repo: DatasetRepository }) =>
  (id: string): Promise<Dataset | undefined> =>
    deps.repo.getById(id);
