import { RouteOptions } from 'fastify';
import { getHealthHandler } from './handlers';

const route: RouteOptions = {
  method: 'GET',
  url: '/health',
  schema: {
    tags: ['health'],
  },
  handler: getHealthHandler,
};

export const routes: RouteOptions[] = [route];
