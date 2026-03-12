import { FastifyInstance } from 'fastify';
import { Middleware } from '../types';

/**
 * 註冊中介軟體
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function registerMiddlewares(
  app: FastifyInstance,
  middlewares: Middleware[],
) {
  // 添加請求 ID
  app.addHook('onRequest', (request, reply, done) => {
    request.id = request.id || generateRequestId();
    done();
  });

  // 添加回應時間記錄
  app.addHook('onRequest', (request, reply, done) => {
    request.startTime = Date.now();
    done();
  });

  app.addHook('onSend', (request, reply, payload, done) => {
    const responseTime = Date.now() - (request.startTime || Date.now());
    reply.header('X-Response-Time', `${responseTime}ms`);
    done(null, payload);
  });

  // 註冊自定義中介軟體
  for (const middleware of middlewares) {
    if (typeof middleware === 'function') {
      app.addHook('preHandler', middleware);
    }
  }
}

/**
 * 生成請求 ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
