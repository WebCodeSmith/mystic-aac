import Redis from 'ioredis';
import logger from '../config/logger';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379')
});

export const cacheService = {
  async init(): Promise<void> {
    try {
      await redis.ping();
      logger.info('✅ Conexão com Redis estabelecida com sucesso');
    } catch (error) {
      logger.error('❌ Falha ao conectar com Redis', error);
      throw error;
    }
  },

  async get<T>(key: string): Promise<T | null> {
    const cachedData = await redis.get(key);
    return cachedData ? JSON.parse(cachedData) : null;
  },

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
  },

  async delete(key: string): Promise<void> {
    await redis.del(key);
  },

  async clearPrefix(prefix: string): Promise<void> {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },

  async reset(): Promise<void> {
    try {
      await redis.flushall();
      logger.info('🧹 Cache Redis limpo completamente');
    } catch (error) {
      logger.error('❌ Falha ao limpar cache Redis', error);
      throw error;
    }
  }
};
