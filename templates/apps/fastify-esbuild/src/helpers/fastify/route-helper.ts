// infrastructures/route-helpers.ts
import { FastifyPluginAsync, FastifyInstance, RouteOptions } from 'fastify';

export interface PluginRoute {
  prefix: string;
  plugin: FastifyPluginAsync;
}

export function createPluginFromRoutes(routes: RouteOptions[]): FastifyPluginAsync {
  // eslint-disable-next-line @typescript-eslint/require-await
  return async (fastify: FastifyInstance) => {
    for (const route of routes) fastify.route(route);
  };
}
