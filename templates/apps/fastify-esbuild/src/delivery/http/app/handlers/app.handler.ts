import { RouteHandlerMethod } from 'fastify/types/route';

export const getAppHandler: RouteHandlerMethod = async (req, reply) => {
  reply.send({ message: 'App is running' });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const testAppError: RouteHandlerMethod = async (req, reply) => {
  throw new Error('Test error');
};
