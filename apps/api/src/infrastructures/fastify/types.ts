import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

export type HttpRouteModuleType = 'http';
export interface HttpRouteModule {
  type: HttpRouteModuleType;
  prefix: string;
  plugin: FastifyPluginAsync;
}

export interface Middleware {
  (request: FastifyRequest, reply: FastifyReply): Promise<void>;
}

export interface FastifyAppOptions {
  httpRouteModules?: HttpRouteModule[];
  middlewares?: Middleware[];
  isApiDocEnabled?: boolean;
  /** Cleanup run on Fastify `onClose` (e.g. closing the DB pool) during graceful shutdown. */
  onClose?: () => void | Promise<void>;
}
