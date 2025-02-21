import 'dotenv/config';
import express, { 
  Application, 
  Request, 
  Response, 
  NextFunction,
  static as expressStatic  
} from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import session from 'express-session';
import compression from 'compression';
import methodOverride from 'method-override';
import http from 'http';
import Redis from 'ioredis'; // Importar Redis
import * as connectRedisModule from 'connect-redis';
import crypto from 'crypto';

// Utilitários personalizados
import { 
  ServerErrorHandler, 
  ConfigurationHelper, 
  DynamicImportHelper, 
  ServerLogger,
  NodeEnvironment
} from './utils/server-helpers';

// Middleware
import { errorHandler } from './middleware/error-handler';
import { apiLimiter, loginLimiter } from './middleware/rate-limiter';
import { globalLogger } from './middleware/global-logger';
import { requireAuth } from './middleware/auth-middleware';

// Serviços
import prisma from './services/prisma';
import { cacheService } from './utils/cache';
import logger from './config/logger';

// Rotas
import authRoutes from './routes/auth';
import accountRoutes from './routes/account';
import newsRoutes from './routes/news';
import playerRoutes from './routes/players';

// Tipos para configuração de ambiente
interface EnvironmentConfig {
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  corsOrigin: string[];
  serverName: string;
  nodeEnv: NodeEnvironment;
  redisHost: string; // Adicionar propriedade redisHost
  redisPort: number; // Adicionar propriedade redisPort
  redisDb: number; // Adicionar propriedade redisDb
}

interface CompressionOptions {
  filter?: (req: Request, res: Response) => boolean;
  threshold?: number | string;
  level?: number;
  chunkSize?: number;
}

class Server {
  private app: Application;
  private server: http.Server | null = null;
  private port: number;
  private config: EnvironmentConfig;
  private redisClient: Redis; // Adicionar tipo Redis

  constructor() {
    this.app = express();
    this.config = this.loadEnvironmentConfig();
    this.port = this.config.port;
    
    // Inicializar redisClient no construtor
    this.redisClient = new Redis({
      host: this.config.redisHost,
      port: this.config.redisPort,
      db: this.config.redisDb
    });

    this.validateEnvironmentConfig(this.config);
    this.configureStaticFiles();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.setupGracefulShutdown();
  }

  private loadEnvironmentConfig(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV as NodeEnvironment || 'development';
    
    // Configurações padrão
    const defaultConfig: EnvironmentConfig = {
      port: 3000,
      databaseUrl: 'postgresql://localhost/default_db',
      sessionSecret: 'default_secret_key',
      corsOrigin: ['http://localhost:3000'],
      serverName: 'LocalServer',
      nodeEnv,
      redisHost: 'localhost', // Adicionar valor padrão para redisHost
      redisPort: 6379, // Adicionar valor padrão para redisPort
      redisDb: 0 // Adicionar valor padrão para redisDb
    };

    // Sobrescrever configurações padrão com variáveis de ambiente
    const config: EnvironmentConfig = {
      port: parseInt(process.env.PORT || '3000', 10),
      databaseUrl: process.env.DATABASE_URL || defaultConfig.databaseUrl,
      sessionSecret: process.env.SESSION_SECRET || defaultConfig.sessionSecret,
      corsOrigin: process.env.CORS_ORIGIN?.split(',') || defaultConfig.corsOrigin,
      serverName: process.env.SERVER_NAME || defaultConfig.serverName,
      nodeEnv,
      redisHost: process.env.REDIS_HOST || defaultConfig.redisHost, // Adicionar valor para redisHost
      redisPort: parseInt(process.env.REDIS_PORT || '6379', 10), // Adicionar valor para redisPort
      redisDb: parseInt(process.env.REDIS_DB || '0', 10) // Adicionar valor para redisDb
    };

    return config;
  }

  private validateEnvironmentConfig(config: EnvironmentConfig) {
    const requiredVars: (keyof EnvironmentConfig)[] = [
      'port', 
      'databaseUrl', 
      'sessionSecret', 
      'corsOrigin', 
      'serverName',
      'redisHost', // Adicionar redisHost
      'redisPort', // Adicionar redisPort
      'redisDb' // Adicionar redisDb
    ];

    const missingVars = requiredVars.filter(varName => {
      const value = config[varName];
      return value === undefined || 
             (Array.isArray(value) && value.length === 0) ||
             (typeof value === 'string' && value.trim() === '');
    });

    if (missingVars.length > 0) {
      ServerErrorHandler.criticalExit(
        `Variáveis de ambiente não definidas: ${missingVars.join(', ')}`, 
        new Error('Configuração de ambiente inválida')
      );
    }

    // Validações adicionais
    if (config.port < 0 || config.port > 65535) {
      ServerErrorHandler.criticalExit(
        `Porta inválida: ${config.port}`, 
        new Error('Porta de servidor inválida')
      );
    }

    // Configurações específicas de ambiente
    if (config.nodeEnv === 'development') {
      ServerLogger.developmentMode();
      this.app.use((req, res, next) => {
        res.setHeader('X-Development-Mode', 'true');
        next();
      });
    }
  }

  private configureStaticFiles() {
    const staticOptions = {
      maxAge: ConfigurationHelper.getEnvironmentConfig(
        0, 
        86400000, // 1 dia em milissegundos
        this.config.nodeEnv
      ),
      dotfiles: 'ignore',
      setHeaders: (res: Response, filePath: string) => {
        if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
      }
    };

    // Servir arquivos estáticos com opções específicas
    this.app.use(express.static(path.join(__dirname, '../public'), staticOptions));
    this.app.use('/images', express.static(path.join(__dirname, '../public/images'), staticOptions));
    this.app.use('/css', express.static(path.join(__dirname, '../public/css'), staticOptions));
    this.app.use('/styles', express.static(path.join(__dirname, '../public/styles'), staticOptions));
  }

  private async initializeMiddleware() {
    // Configuração do Redis com opções de reconexão
    this.redisClient.on('error', (err) => {
      logger.error('Erro na conexão Redis:', err);
    });

    this.redisClient.on('connect', () => {
      ServerLogger.serviceConnection('Redis', 'connected');
    });

    // Configuração de sessão ANTES de qualquer outro middleware
    const RedisStore = DynamicImportHelper.resolveModule(connectRedisModule);

    const sessionStore = new RedisStore({ 
      client: this.redisClient,
      prefix: 'sess:',
      ttl: 86400, // 1 dia em segundos
      disableTouch: false,
      logErrors: (err: Error) => {
        logger.error('Erro no RedisStore:', err);
      }
    });

    // Configuração completa de sessão
    this.app.use(session({
      store: sessionStore,
      secret: this.config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: this.config.nodeEnv === 'production' && process.env.HTTPS === 'true', // Somente seguro se explicitamente definido
        maxAge: 24 * 60 * 60 * 1000, // 24 horas
        sameSite: 'lax'
      }
    }));

    // Segurança e outros middlewares
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:"]
        }
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));

    // CORS e outros middlewares
    this.app.use(cors({
      origin: this.config.corsOrigin,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(methodOverride());
    this.app.use(compression({ 
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    } as CompressionOptions)); 
    this.app.use(globalLogger);

    // Configuração do template engine
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, '../views'));
  }

  private initializeRoutes() {
    // Healthcheck
    this.app.get('/health', (req, res) => {
      const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        database: prisma ? 'Connected' : 'Disconnected',
        cache: cacheService ? 'Initialized' : 'Not Available'
      };
      
      res.status(200).json(healthcheck);
    });

    // Rota de autenticação unificada
    this.app.route('/login')
      .get(loginLimiter, (req, res, next) => {
        authRoutes(req, res, next);
      })
      .post(loginLimiter, (req, res, next) => {
        authRoutes(req, res, next);
      });

    // Rotas públicas com rate limiting
    this.app.use('/auth', loginLimiter, authRoutes);
    this.app.use('/account', apiLimiter, accountRoutes);
    this.app.use('/news', newsRoutes);
    this.app.use('/players', playerRoutes);

    // Rota de logout
    this.app.get('/logout', (req, res, next) => {
      authRoutes(req, res, next);
    });

    // Rota do dashboard com middleware de autenticação
    this.app.get('/dashboard', requireAuth, async (req, res) => {
      try {
        // Buscar informações do jogador
        const player = await prisma.player.findUnique({
          where: { 
            accountId: req.session?.user?.id 
          },
          select: {
            id: true,
            name: true,
            level: true,
            avatar: true,
            vocation: true,
            experience: true
          }
        });

        res.render('pages/dashboard', {
          user: req.session?.user,
          player: player,
          title: 'Dashboard'
        });
      } catch (error) {
        logger.error('Erro ao buscar informações do jogador:', error);
        res.status(500).render('pages/error', {
          title: 'Erro',
          message: 'Não foi possível carregar as informações do jogador'
        });
      }
    });

    // Rota inicial com cache
    this.app.get('/', apiLimiter, async (req, res, next) => {
      try {
        const cacheKey = 'home:dashboard';
        const cachedData = await cacheService.get(cacheKey);

        if (cachedData) {
          return res.render('pages/index', cachedData);
        }

        const [news, topPlayers, onlinePlayers, totalPlayers] = await Promise.all([
          prisma.news.findMany({
            orderBy: { date: 'desc' },
            take: 10
          }),
          prisma.player.findMany({
            orderBy: { level: 'desc' },
            take: 4,
            select: {
              id: true,
              name: true,
              level: true,
              vocation: true,
              avatar: true
            }
          }),
          prisma.account.count({
            where: { 
              lastLogin: {
                gte: new Date(Date.now() - 15 * 60 * 1000) // Últimos 15 minutos
              },
              isActive: true
            }
          }),
          prisma.player.count()
        ]);

        const homeData = { 
          title: 'Início',
          serverName: this.config.serverName,
          news,
          topPlayers,
          onlinePlayers,
          totalPlayers
        };

        await cacheService.set(cacheKey, homeData, 300); // Cache por 5 minutos

        res.render('pages/index', homeData);
      } catch (error) {
        next(error);
      }
    });
  }

  private initializeErrorHandling() {
    // Tratamento de rotas não encontradas
    this.app.use((req, res, next) => {
      res.status(404).render('pages/error', {
        title: 'Página não encontrada',
        message: 'A página que você está procurando não existe.'
      });
    });

    // Middleware de erro global
    this.app.use(errorHandler);
  }

  private setupGracefulShutdown() {
    const shutdown = ServerErrorHandler.gracefulShutdown('Desligamento do Servidor', async () => {
      // Fechar conexões do banco de dados
      await prisma.$disconnect();
      
      // Limpar cache
      await cacheService.reset();
    });

    // Capturar sinais de término
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  public start() {
    try {
      const startServer = async () => {
        await prisma.$connect();
        await cacheService.init();

        this.server = this.app.listen(this.port, () => {
          ServerLogger.serverStart(this.port, this.config.nodeEnv);
        });
      };

      startServer().catch(error => 
        ServerErrorHandler.criticalExit('Inicialização do Servidor', error)
      );
    } catch (error) {
      ServerErrorHandler.criticalExit('Inicialização do Servidor', error);
    }
  }
}

// Iniciar servidor
const server = new Server();
server.start();
