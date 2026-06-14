import { CreateDatasetInputSchema, type Dataset } from '../schema';
import type { DatasetRepository } from '../repository';

export const makeCreateDataset =
  (deps: { repo: DatasetRepository }) =>
  async (input: unknown): Promise<Dataset> => {
    const parsed = CreateDatasetInputSchema.parse(input);
    return deps.repo.create(parsed);
  };
