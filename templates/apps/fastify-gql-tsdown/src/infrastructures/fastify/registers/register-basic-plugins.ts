import { configs } from '@/configs';
import { FastifyInstance } from 'fastify';

/**
 * 註冊基本插件
 */
export async function registerBasicPlugins(app: FastifyInstance): Promise<void> {
  // 註冊 CORS 插件
  await app.register(import('@fastify/cors'), {
    origin: (origin, callback) => {
      // 在開發環境或測試環境允許所有來源
      if (
        configs.env === 'development' ||
        configs.env === 'local' ||
        configs.env === 'test'
      ) {
        callback(null, true);
        return;
      }

      // 生產環境的 CORS 設定
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
  });

  // 註冊 multipart 支援（用於檔案上傳）
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

  // 註冊 formbody 支援
  await app.register(import('@fastify/formbody'));

  // 註冊 sensible 插件（提供有用的工具和裝飾器）
  await app.register(import('@fastify/sensible'));
}
