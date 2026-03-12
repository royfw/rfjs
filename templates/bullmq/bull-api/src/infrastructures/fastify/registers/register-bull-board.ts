import { FastifyInstance } from 'fastify';
import { FastifyAdapter } from '@bull-board/fastify';
import { createBullBoard } from '@bull-board/api';
// import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
// import { queues } from '@commission-system/queue';

/**
 * 註冊 API 文件
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function registerBullBoard(app: FastifyInstance) {
  // 1. 建立 Bull Board 需要的 Fastify 伺服器轉接器
  const serverAdapter = new FastifyAdapter();

  // const queues: Queue<any, any, string, any, any, string>[] = [];

  // 2. 建立 Bull Board 實例
  createBullBoard({
    // 轉換成 Bull Board 認識的 BullMQAdapter 陣列
    // queues: queues.map((queue) => new BullMQAdapter(queue)),
    queues: [],
    serverAdapter: serverAdapter,
  });

  // 3. 設定 Bull Board UI 的基礎路徑
  serverAdapter.setBasePath('/dashboard');

  // 4. 將 Bull Board 註冊為 Fastify 的一個插件 (plugin)
  app.register(serverAdapter.registerPlugin(), {
    prefix: '/dashboard',
  });

  app.get('/', async (request, reply) => {
    reply.redirect('dashboard');
  });
}
