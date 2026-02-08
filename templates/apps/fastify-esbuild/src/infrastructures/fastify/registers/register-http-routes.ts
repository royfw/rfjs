import { FastifyInstance } from 'fastify';
import { HttpRouteModule } from '../types';

/**
 * 註冊 HTTP 路由模組
 */
export async function registerHttpRouteModules(
  app: FastifyInstance,
  httpRouteModules: HttpRouteModule[],
): Promise<void> {
  // 註冊自定義控制器
  for (const httpRouteModule of httpRouteModules) {
    const { type, prefix, plugin } = httpRouteModule;
    if (!type || type !== 'http') continue;
    if (!prefix || !plugin) continue; // 跳過無效的模組
    await app.register(plugin, { prefix });
  }
}
