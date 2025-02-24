"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const session_1 = __importDefault(require("@fastify/session"));
const compress_1 = __importDefault(require("@fastify/compress"));
const formbody_1 = __importDefault(require("@fastify/formbody"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const view_1 = __importDefault(require("@fastify/view"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const ejs = __importStar(require("ejs"));
const path_1 = __importDefault(require("path"));
const ioredis_1 = __importDefault(require("ioredis"));
const client_1 = require("@prisma/client");
const server_helpers_1 = require("./utils/server-helpers");
const config_service_1 = require("./services/config.service");
const redis_session_store_1 = require("./utils/redis-session-store");
const rate_limiter_1 = require("./utils/rate-limiter");
const global_logger_1 = require("./middleware/global-logger");
const news_1 = __importDefault(require("./routes/news"));
const auth_1 = __importDefault(require("./routes/auth"));
const account_1 = __importDefault(require("./routes/account"));
const character_1 = __importDefault(require("./routes/character"));
const fastify_custom_1 = require("./types/fastify-custom");
class Server {
    constructor() {
        this.configService = new config_service_1.ConfigService();
        this.resourceManager = new server_helpers_1.ResourceManager();
        this.prisma = new client_1.PrismaClient();
        this.redisClient = new ioredis_1.default(this.configService.getRedisConfig());
        this.app = (0, fastify_1.default)({
            logger: {
                level: process.env.LOGGING_LEVEL || 'info',
                transport: !this.configService.isProduction() ? {
                    target: 'pino-pretty',
                    options: {
                        translateTime: 'HH:MM:ss Z',
                        ignore: 'pid,hostname'
                    }
                } : undefined
            }
        });
        this.resourceManager.register('fastify', this.app);
        this.resourceManager.register('redis', this.redisClient);
        this.resourceManager.register('prisma', this.prisma);
    }
    async configureMiddleware() {
        await this.app.register(formbody_1.default);
        await this.app.register(cors_1.default, this.configService.getCorsOptions());
        await this.app.register(helmet_1.default, {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        });
        await this.app.register(compress_1.default, {
            global: true,
            threshold: 1024,
            zlib: { level: 6 }
        });
        await this.app.register(view_1.default, {
            engine: { ejs },
            root: path_1.default.join(__dirname, '../views'),
            options: {
                useHtmlMinifier: true,
                htmlMinifierOptions: {
                    removeComments: true,
                    collapseWhitespace: true
                }
            }
        });
        await this.app.register(require('@fastify/static'), {
            root: path_1.default.join(__dirname, '../public'),
            prefix: '/',
            decorateReply: false
        });
        await this.app.register(cookie_1.default);
        const sessionSecret = this.configService.get('sessionSecret');
        const sessionOptions = {
            secret: Array.isArray(sessionSecret) ? sessionSecret[0] : String(sessionSecret),
            store: (0, redis_session_store_1.createRedisSessionStore)(this.redisClient),
            cookie: {
                secure: Boolean(this.configService.get('https')),
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000
            }
        };
        await this.app.register(session_1.default, sessionOptions);
        this.app.addHook('onRequest', global_logger_1.globalLogger);
        this.app.addHook('onRequest', async (request, reply) => {
            const user = (0, fastify_custom_1.getSessionUser)(request);
            reply.locals = { user };
        });
        await this.app.register(rate_limit_1.default, rate_limiter_1.apiLimiter);
    }
    async registerRoutes() {
        await this.app.register(auth_1.default);
        await this.app.register(news_1.default, { prefix: '/news' });
        await this.app.register(account_1.default, { prefix: '/account' });
        await this.app.register(character_1.default, { prefix: '/character' });
    }
    async start() {
        try {
            await this.configureMiddleware();
            await this.registerRoutes();
            const port = Number(this.configService.get('port'));
            const host = '0.0.0.0';
            return new Promise((resolve, reject) => {
                this.app.listen({ port, host }, (err, address) => {
                    if (err) {
                        console.error('Erro ao iniciar servidor:', err);
                        reject(err);
                        return;
                    }
                    console.log(`🚀 Servidor iniciado em ${address}`);
                    this.resourceManager.setupGracefulShutdown();
                    resolve();
                });
            });
        }
        catch (err) {
            console.error('Erro ao configurar servidor:', err);
            process.exit(1);
        }
    }
}
exports.Server = Server;
const server = new Server();
server.start();
