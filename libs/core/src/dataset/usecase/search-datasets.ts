import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';
import { SearchBodySchema } from '../filter-schema';

export const makeSearchDatasets =
  (deps: { repo: DatasetRepository }) =>
  async (input: unknown): Promise<Dataset[]> => {
    const { filter } = SearchBodySchema.parse(input);
    return deps.repo.search(filter);
  };
