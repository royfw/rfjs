import { FastifyPluginAsync } from 'fastify';
import { routes } from './routes';
import { HttpRouteModule } from '@/infrastructures';
import { createPluginFromRoutes } from '@/helpers/fastify';

const plugin: FastifyPluginAsync = createPluginFromRoutes(routes);

export const healthHttpRouteModule: HttpRouteModule = {
  type: 'http',
  prefix: '/',
  plugin,
};
