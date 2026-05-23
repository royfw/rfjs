import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import { configs } from '@/configs';
import { registerBasicPlugins, registerMiddlewares, registerApiDocs } from './registers';
import { FastifyAppOptions, registerHttpRouteModules } from '.';
import { pinoTransport } from '@/helpers/pino';

/**
 * 初始化 Fastify 應用程式實例
 * @param options 應用程式選項
 * @returns Fastify 實例
 */
export async function initializeFastifyApp(
  options: FastifyAppOptions = {},
): Promise<FastifyInstance> {
  const { httpRouteModules = [], middlewares = [], isApiDocEnabled = true } = options;

  // Fastify 伺服器選項
  const fastifyOptions: FastifyServerOptions = {
    logger: {
      level: configs.env === 'production' ? 'info' : 'debug',
      transport: pinoTransport,
    },
  };

  // 建立 Fastify 實例
  const app = Fastify(fastifyOptions);

  // 註冊 API 文件（如果啟用）
  if (isApiDocEnabled) {
    await registerApiDocs(app);
  }

  // 註冊基本插件
  await registerBasicPlugins(app);

  // 註冊中介軟體
  await registerMiddlewares(app, middlewares);

  // 註冊 HTTP 路由模組
  await registerHttpRouteModules(app, httpRouteModules);

  return app;
}
