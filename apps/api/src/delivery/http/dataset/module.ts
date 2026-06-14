import { FastifyPluginAsync } from 'fastify';
import { datasetRoutes } from './routes';
import { HttpRouteModule } from '@/infrastructures';
import { createPluginFromRoutes } from '@/helpers';

const plugin: FastifyPluginAsync = createPluginFromRoutes(datasetRoutes);

export const datasetHttpRouteModule: HttpRouteModule = {
  type: 'http',
  prefix: '/',
  plugin,
};
