import 'dotenv/config';
import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import fastifySession from '@fastify/session';
import { FastifySessionOptions } from '@fastify/session';
import compress from '@fastify/compress';
import formBody from '@fastify/formbody';
import cookie from '@fastify/cookie';
import view from '@fastify/view';
import rateLimit from '@fastify/rate-limit';
import * as ejs from 'ejs';
import path from 'path';
import Redis from 'ioredis';
import { Prisma, PrismaClient } from '@prisma/client';

import { ResourceManager } from './utils/server-helpers';
import { ConfigService } from './services/config.service';
import { createRedisSessionStore } from './utils/redis-session-store';
import { apiLimiter } from './utils/rate-limiter';
import { globalLogger } from './middleware/global-logger';
import newsRoutes from './routes/news';
import authRoutes from './routes/auth';
import accountRoutes from './routes/account';
import characterRoutes from './routes/character';
import { getSessionUser } from './types/fastify-custom';

export class Server {
  private readonly app: FastifyInstance;
  private readonly configService: ConfigService;
  private readonly resourceManager: ResourceManager;
  private readonly prisma: PrismaClient;
  private readonly redisClient: Redis;

  constructor() {
    // Inicializar serviços
    this.configService = new ConfigService();
    this.resourceManager = new ResourceManager();
    this.prisma = new PrismaClient();
    this.redisClient = new Redis(this.configService.getRedisConfig());

    // Criar instância do Fastify
    this.app = fastify({
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

    // Registrar recursos
    this.resourceManager.register('fastify', this.app);
    this.resourceManager.register('redis', this.redisClient);
    this.resourceManager.register('prisma', this.prisma);
  }

  private async configureMiddleware() {
    await this.app.register(formBody);
    await this.app.register(cors, this.configService.getCorsOptions());
    await this.app.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      }
    });
    await this.app.register(compress, {
      global: true,
      threshold: 1024,
      zlib: { level: 6 }
    });
    await this.app.register(view, {
      engine: { ejs },
      root: path.join(__dirname, '../views'),
      options: {
        useHtmlMinifier: true,
        htmlMinifierOptions: {
          removeComments: true,
          collapseWhitespace: true
        }
      }
    });
    
    // Adicionar registro de arquivos estáticos
    await this.app.register(require('@fastify/static'), {
      root: path.join(__dirname, '../public'),
      prefix: '/', // Serve os arquivos na raiz
      decorateReply: false
    });

    await this.app.register(cookie);
    
    // Configuração de sessão com tipagem correta
    const sessionSecret = this.configService.get('sessionSecret');
    const sessionOptions: FastifySessionOptions = {
      secret: Array.isArray(sessionSecret) ? sessionSecret[0] : String(sessionSecret),
      store: createRedisSessionStore(this.redisClient),
      cookie: {
        secure: Boolean(this.configService.get('https')),
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      }
    };

    await this.app.register(fastifySession, sessionOptions);

    this.app.addHook('onRequest', globalLogger);
    this.app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getSessionUser(request);
      reply.locals = { user };
    });
    await this.app.register(rateLimit, apiLimiter);
  }

  /**
   * Register routes for the Fastify app.
   *
   * This method registers the root route without a prefix, and then registers
   * the other routes with their respective prefixes.
   *
   * @returns {Promise<void>} A promise that resolves when the routes are registered.
   */
  private async registerRoutes() {
    // Registrar rota raiz sem prefixo
    await this.app.register(authRoutes);

    // Outras rotas com prefixos
    await this.app.register(newsRoutes, { prefix: '/news' });
    await this.app.register(accountRoutes, { prefix: '/account' });
    await this.app.register(characterRoutes, { prefix: '/character' });
  }

  async start() {
    try {
      await this.configureMiddleware();
      await this.registerRoutes();

      const port = Number(this.configService.get('port'));
      const host = '0.0.0.0';

      return new Promise<void>((resolve, reject) => {
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
    } catch (err) {
      console.error('Erro ao configurar servidor:', err);
      process.exit(1);
    }
  }
}

const server = new Server();
server.start();
