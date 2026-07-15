import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';

export const makeListDatasets =
  (deps: { repo: DatasetRepository }) =>
  (): Promise<Dataset[]> =>
    deps.repo.list();
