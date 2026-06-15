import { createDb } from '@rfjs/db';
import {
  makeDatasetRepository,
  makeListDatasets,
  makeGetDataset,
  makeCreateDataset,
  makeQueryDatasets,
} from '@rfjs/core';
import { configs } from '@/configs';

const { db, pool } = createDb(configs.databaseUrl);
const datasetRepository = makeDatasetRepository(db);

export const datasetUsecases = {
  list: makeListDatasets({ repo: datasetRepository }),
  get: makeGetDataset({ repo: datasetRepository }),
  create: makeCreateDataset({ repo: datasetRepository }),
  query: makeQueryDatasets({ repo: datasetRepository }),
};

/** Drains and closes the shared PG pool — wired into Fastify's `onClose` for graceful shutdown. */
export const closeDatasource = (): Promise<void> => pool.end();
