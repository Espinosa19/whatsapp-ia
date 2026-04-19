import { createClient } from 'redis';

let redisClient = null;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
    });

    redisClient.on('error', (err) => {
      console.error('❌ Error Redis:', err);
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis conectado');
    });

    await redisClient.connect();
  }

  return redisClient;
}

export default getRedisClient;
