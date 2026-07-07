import type { Dataset } from '../schema';
import type { DatasetRepository } from '../repository';
import { QueryDatasetsBodySchema } from '../query-schema';

export interface QueryDatasetsResult {
  items: Dataset[];
  total: number;
  page: number;
  pageSize: number;
}

export const makeQueryDatasets =
  (deps: { repo: DatasetRepository }) =>
  async (input: unknown): Promise<QueryDatasetsResult> => {
    const body = QueryDatasetsBodySchema.parse(input);
    const { items, total } = await deps.repo.query(body);
    return { items, total, page: body.page, pageSize: body.pageSize };
  };
