/**
 * Redis Cache Clear Script
 *
 * Clears all cached data from Redis to free up memory.
 * Works with both local and production Redis instances.
 */

import { createClient } from 'redis';

async function clearRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.error('❌ REDIS_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔌 Connecting to Redis...');
  console.log(`📍 URL: ${redisUrl.replace(/:[^:]*@/, ':****@')}`); // Hide password

  const redis = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) return new Error('Max retries reached');
        return Math.min(retries * 100, 3000);
      },
    },
  });

  redis.on('error', (err) => console.error('Redis Client Error', err));

  try {
    await redis.connect();
    console.log('✅ Connected to Redis');

    // Get key count before clearing
    const dbSize = await redis.dbSize();
    console.log(`🔑 Keys before: ${dbSize}`);

    try {
      // Try to get memory info (may not work on all Redis instances)
      const infoBefore = await redis.sendCommand(['INFO', 'memory']) as string;
      const usedMemoryBefore = infoBefore.match(/used_memory_human:(.+)/)?.[1]?.trim();
      if (usedMemoryBefore) {
        console.log(`📊 Memory before: ${usedMemoryBefore}`);
      }
    } catch (e) {
      console.log('📊 Memory info not available');
    }

    // Clear all keys in current database
    console.log('🧹 Clearing Redis cache...');
    await redis.flushDb();

    // Get stats after clearing
    const dbSizeAfter = await redis.dbSize();

    try {
      const infoAfter = await redis.sendCommand(['INFO', 'memory']) as string;
      const usedMemoryAfter = infoAfter.match(/used_memory_human:(.+)/)?.[1]?.trim();
      if (usedMemoryAfter) {
        console.log(`📊 Memory after: ${usedMemoryAfter}`);
      }
    } catch (e) {
      // Ignore if memory info not available
    }

    console.log('✅ Redis cache cleared successfully!');
    console.log(`🔑 Keys after: ${dbSizeAfter}`);
    console.log(`🎉 Freed up ${dbSize} keys`);

  } catch (error: any) {
    console.error('❌ Error clearing Redis:', error.message);
    process.exit(1);
  } finally {
    await redis.disconnect();
    console.log('👋 Disconnected from Redis');
  }
}

// Run the script
clearRedis().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
