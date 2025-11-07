/**
 * Cache Service
 * Handles caching for ADO query results with 5-minute TTL
 */

import { RedisClientType } from 'redis';
import { getRedisClient } from './client';

const DEFAULT_TTL = 300; // 5 minutes in seconds

export class CacheService {
  private redis: RedisClientType | null = null;
  private redisAvailable: boolean = true;

  async getClient(): Promise<RedisClientType | null> {
    if (!this.redisAvailable) {
      return null;
    }

    if (!this.redis) {
      try {
        this.redis = await getRedisClient();
      } catch (error) {
        console.warn('[Cache Service] Redis unavailable, caching disabled');
        this.redisAvailable = false;
        return null;
      }
    }
    return this.redis;
  }

  /**
   * Get a cached value
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getClient();
      if (!client) return null;

      const value = await client.get(key);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[Cache Service] Error getting cache:', error);
      return null;
    }
  }

  /**
   * Set a cached value with TTL
   */
  async set(key: string, value: any, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;

      await client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('[Cache Service] Error setting cache:', error);
    }
  }

  /**
   * Delete a cache key or pattern
   */
  async delete(keyOrPattern: string): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;

      // Check if it's a pattern (contains *)
      if (keyOrPattern.includes('*')) {
        const keys = await client.keys(keyOrPattern);
        if (keys.length > 0) {
          await client.del(keys);
        }
      } else {
        await client.del(keyOrPattern);
      }
    } catch (error) {
      console.error('[Cache Service] Error deleting cache:', error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      if (!client) return false;

      const result = await client.exists(key);
      return result > 0;
    } catch (error) {
      console.error('[Cache Service] Error checking cache existence:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = await this.getClient();
      if (!client) return -1;

      return await client.ttl(key);
    } catch (error) {
      console.error('[Cache Service] Error getting TTL:', error);
      return -1;
    }
  }

  /**
   * Clear all cache keys matching pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const client = await this.getClient();
      if (!client) return 0;

      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      return keys.length;
    } catch (error) {
      console.error('[Cache Service] Error clearing pattern:', error);
      return 0;
    }
  }
}

export default CacheService;
