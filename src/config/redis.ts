import { createClient } from 'redis';
import logger from '../config/logger';

const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
    password: process.env.REDIS_PASSWORD || undefined
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
    logger.info('Redis Client Connected');
});

// Variável para rastrear se já está conectado
let isConnected = false;

// Conectar ao Redis automaticamente
async function connectRedis() {
    if (isConnected) {
        logger.warn('Tentativa de reconexão ao Redis ignorada');
        return;
    }

    try {
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
        
        await redisClient.connect();
        isConnected = true;
    } catch (error) {
        logger.error('Falha ao conectar ao Redis', error);
        isConnected = false;
        // Não sair do processo para permitir recuperação
    }
}

// Exportar função de conexão e cliente
export { connectRedis, redisClient };

// Conectar automaticamente se não estiver em ambiente de teste
if (process.env.NODE_ENV !== 'test') {
    connectRedis().catch(console.error);
}
