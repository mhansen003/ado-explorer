/**
 * Redis Client Singleton
 * Manages Redis connection for the application
 */

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  console.log('[Redis Client] Connecting to Redis...');

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('[Redis Client] Max reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        return retries * 100; // Exponential backoff
      },
    },
  });

  redisClient.on('error', (err) => {
    console.error('[Redis Client] Error:', err);
  });

  redisClient.on('connect', () => {
    console.log('[Redis Client] Connected to Redis');
  });

  redisClient.on('reconnecting', () => {
    console.log('[Redis Client] Reconnecting to Redis...');
  });

  redisClient.on('ready', () => {
    console.log('[Redis Client] Redis client ready');
  });

  await redisClient.connect();

  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[Redis Client] Disconnected from Redis');
  }
}
