import { Queue } from 'bullmq';
import { redisConnection } from '@/redis';
import { QUEUES } from '@/consts';

export const demoQueue: Queue = new Queue(QUEUES.DEMO, {
  connection: redisConnection,
});
