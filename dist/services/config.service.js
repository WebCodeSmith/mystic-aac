"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const ConfigSchema = zod_1.z.object({
    port: zod_1.z.number().min(0).max(65535).default(3000),
    nodeEnv: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    databaseUrl: zod_1.z.string().url(),
    sessionSecret: zod_1.z.string().min(16),
    corsOrigin: zod_1.z.array(zod_1.z.string().url()).default(['http://localhost:3000']),
    serverName: zod_1.z.string().default('LocalServer'),
    redis: zod_1.z.object({
        host: zod_1.z.string().default('localhost'),
        port: zod_1.z.number().min(0).max(65535).default(6379),
        db: zod_1.z.number().min(0).default(0)
    }),
    https: zod_1.z.boolean().default(false)
});
class ConfigService {
    constructor() {
        this.config = this.loadAndValidateConfig();
    }
    loadAndValidateConfig() {
        const rawConfig = {
            port: parseInt(process.env.PORT || '3000', 10),
            nodeEnv: process.env.NODE_ENV || 'development',
            databaseUrl: process.env.DATABASE_URL,
            sessionSecret: process.env.SESSION_SECRET,
            corsOrigin: process.env.CORS_ORIGIN?.split(','),
            serverName: process.env.SERVER_NAME,
            redis: {
                host: process.env.REDIS_HOST,
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
                db: parseInt(process.env.REDIS_DB || '0', 10)
            },
            https: process.env.HTTPS === 'true'
        };
        try {
            return ConfigSchema.parse(rawConfig);
        }
        catch (error) {
            console.error('Configuração inválida:', error);
            process.exit(1);
        }
    }
    getServerName() {
        return this.config.serverName;
    }
    get(key) {
        return this.config[key];
    }
    getRedisConfig() {
        return this.config.redis;
    }
    isProduction() {
        return this.config.nodeEnv === 'production';
    }
    getCorsOptions() {
        return {
            origin: this.config.corsOrigin,
            credentials: true
        };
    }
    getSessionConfig() {
        return {
            secret: this.config.sessionSecret,
            cookie: {
                secure: this.config.https,
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000
            }
        };
    }
}
exports.ConfigService = ConfigService;
