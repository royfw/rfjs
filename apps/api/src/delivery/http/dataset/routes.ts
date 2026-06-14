import { RouteOptions } from 'fastify';
import {
  listDatasetsHandler,
  getDatasetHandler,
  createDatasetHandler,
  searchDatasetsHandler,
} from './handlers';

export const datasetRoutes: RouteOptions[] = [
  {
    method: 'GET',
    url: '/datasets',
    schema: { tags: ['dataset'] },
    handler: listDatasetsHandler,
  },
  {
    method: 'GET',
    url: '/datasets/:id',
    schema: { tags: ['dataset'] },
    handler: getDatasetHandler,
  },
  {
    method: 'POST',
    url: '/datasets',
    schema: { tags: ['dataset'] },
    handler: createDatasetHandler,
  },
  {
    method: 'POST',
    url: '/datasets/query',
    schema: { tags: ['dataset'] },
    handler: searchDatasetsHandler,
  },
];
