import { FastifyPluginAsync } from 'fastify';
import { appRoutes } from './routes';
import { HttpRouteModule } from '@/infrastructures';
import { createPluginFromRoutes } from '@/helpers';

const plugin: FastifyPluginAsync = createPluginFromRoutes(appRoutes);

export const appHttpRouteModule: HttpRouteModule = {
  type: 'http',
  prefix: '/',
  plugin,
};
