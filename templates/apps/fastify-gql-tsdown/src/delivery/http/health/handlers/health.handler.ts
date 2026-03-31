import { configs } from '@/configs';
import { RouteHandlerMethod } from 'fastify';

export const getHealthHandler: RouteHandlerMethod = async (req, reply) => {
  reply.send(
    // 基本健康檢查路由
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: configs.version,
      environment: configs.env,
    },
  );
};
