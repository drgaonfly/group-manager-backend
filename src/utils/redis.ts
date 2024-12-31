import Redis from 'ioredis';

// 创建 Redis 客户端

let redis: Redis | null = null;

const setupRedis = async (): Promise<void> => {
  if (redis) {
    return;
  }

  redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    db: Number(process.env.REDIS_DB),
  });

  // 测试连接
  redis.on('connect', () => {
    console.log('已连接到 Redis');
  });

  redis.on('error', (err) => {
    console.error('Redis 连接错误:', err);
    redis = null;
  });
};

export { redis, setupRedis };
