import 'dotenv/config';
import { z } from 'zod';

// Esquema de validação para configurações
const ConfigSchema = z.object({
  port: z.number().min(0).max(65535).default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  databaseUrl: z.string().url(),
  sessionSecret: z.string().min(16),
  corsOrigin: z.array(z.string().url()).default(['http://localhost:3000']),
  serverName: z.string().default('LocalServer'),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().min(0).max(65535).default(6379),
    db: z.number().min(0).default(0)
  }),
  https: z.boolean().default(false)
});

export class ConfigService {
  private config: z.infer<typeof ConfigSchema>;

  constructor() {
    this.config = this.loadAndValidateConfig();
  }

  private loadAndValidateConfig() {
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
    } catch (error) {
      console.error('Configuração inválida:', error);
      process.exit(1);
    }
  }

  getServerName() {
    return this.config.serverName;
  }

  get(key: keyof typeof this.config) {
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
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      }
    };
  }
}
