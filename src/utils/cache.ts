import { createCache, type Cache } from 'cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';

let cache: Cache | null = null;

export const setupCache = async (): Promise<void> => {
  if (cache) {
    return;
  }

  const store = await redisStore({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB) || 0,
  });

  cache = createCache({
    stores: [store as any],
  });

  console.log('Cache manager 已初始化');
};

export const getCache = () => {
  if (!cache) {
    throw new Error('Cache 未初始化，请先调用 setupCache()');
  }
  return cache;
};
