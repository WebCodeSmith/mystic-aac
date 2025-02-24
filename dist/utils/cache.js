"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = __importDefault(require("../config/logger"));
const redis = new ioredis_1.default({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
});
exports.cacheService = {
    async init() {
        try {
            await redis.ping();
            logger_1.default.info('✅ Conexão com Redis estabelecida com sucesso');
        }
        catch (error) {
            logger_1.default.error('❌ Falha ao conectar com Redis', error);
            throw error;
        }
    },
    async get(key) {
        const cachedData = await redis.get(key);
        return cachedData ? JSON.parse(cachedData) : null;
    },
    async set(key, value, ttl = 3600) {
        await redis.set(key, JSON.stringify(value), 'EX', ttl);
    },
    async delete(key) {
        await redis.del(key);
    },
    async clearPrefix(prefix) {
        const keys = await redis.keys(`${prefix}*`);
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    },
    async reset() {
        try {
            await redis.flushall();
            logger_1.default.info('🧹 Cache Redis limpo completamente');
        }
        catch (error) {
            logger_1.default.error('❌ Falha ao limpar cache Redis', error);
            throw error;
        }
    }
};
