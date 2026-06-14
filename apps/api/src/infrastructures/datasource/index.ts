import { createDb } from '@rfjs/db';
import {
  makeDatasetRepository,
  makeListDatasets,
  makeGetDataset,
  makeCreateDataset,
} from '@rfjs/core';
import { configs } from '@/configs';

const { db } = createDb(configs.databaseUrl);
const datasetRepository = makeDatasetRepository(db);

export const datasetUsecases = {
  list: makeListDatasets({ repo: datasetRepository }),
  get: makeGetDataset({ repo: datasetRepository }),
  create: makeCreateDataset({ repo: datasetRepository }),
};
