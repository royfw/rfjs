import IORedis from 'ioredis';

export const redisConnection: IORedis = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  lazyConnect: true,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  db: 0,
});
