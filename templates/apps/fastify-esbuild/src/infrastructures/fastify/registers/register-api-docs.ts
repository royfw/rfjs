import { FastifyInstance } from 'fastify';

/**
 * 註冊 API 文件
 */
export async function registerApiDocs(app: FastifyInstance) {
  app.log.info('API documentation will be implemented in OpenAPI task');
  await app.register(import('@fastify/swagger'), {
    openapi: {
      info: { title: 'API Documentation', version: '1.0.0' },
    },
  });
  await app.register(import('@fastify/swagger-ui'), {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
      onComplete: function () {},
    },
  });
  app.get('/', async (request, reply) => {
    reply.redirect('/api-docs');
  });
}
