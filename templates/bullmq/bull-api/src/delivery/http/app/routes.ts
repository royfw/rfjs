import { RouteOptions } from 'fastify';
import { getAppHandler, testAppError } from './handlers';

const appRoute: RouteOptions = {
  method: 'GET',
  url: '/app',
  schema: {
    tags: ['app'],
  },
  handler: getAppHandler,
};

const testAppErrorRoute: RouteOptions = {
  method: 'GET',
  url: '/app/error',
  schema: {
    tags: ['app'],
  },
  handler: testAppError,
};

export const appRoutes: RouteOptions[] = [appRoute, testAppErrorRoute];
