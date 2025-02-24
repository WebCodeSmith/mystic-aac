"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
exports.connectRedis = connectRedis;
const redis_1 = require("redis");
const logger_1 = __importDefault(require("../config/logger"));
const redisClient = (0, redis_1.createClient)({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD || undefined
});
exports.redisClient = redisClient;
redisClient.on('error', (err) => {
    logger_1.default.error('Redis Client Error', err);
});
redisClient.on('connect', () => {
    logger_1.default.info('Redis Client Connected');
});
let isConnected = false;
async function connectRedis() {
    if (isConnected) {
        logger_1.default.warn('Tentativa de reconexão ao Redis ignorada');
        return;
    }
    try {
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
        await redisClient.connect();
        isConnected = true;
    }
    catch (error) {
        logger_1.default.error('Falha ao conectar ao Redis', error);
        isConnected = false;
    }
}
if (process.env.NODE_ENV !== 'test') {
    connectRedis().catch(console.error);
}
