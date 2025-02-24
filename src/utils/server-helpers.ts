import logger from '../config/logger';

// Constants
const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;
const CLOSE_METHODS = ['close', 'quit', '$disconnect', 'disconnect'] as const;
const DAY_IN_MS = 86400000;

// Types
type ShutdownSignal = typeof SHUTDOWN_SIGNALS[number];
type CloseMethod = typeof CLOSE_METHODS[number];

interface Resource {
  [key: string]: any;
  [key: symbol]: any;
}

interface SecureConfig {
  secure: boolean;
  sameSite: 'strict' | 'lax';
  maxAge: number;
}

// Tipos de ambiente
export type NodeEnvironment = 'development' | 'production' | 'test';

// Error Handler Class
export class ServerErrorHandler {
  static criticalExit(context: string, error: unknown, exitCode = 1): never {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[CRITICAL ERROR] ${context}:`, errorMessage);

    if (!(error instanceof Error)) {
      logger.error('Unknown error type. Details:', JSON.stringify(error));
    }

    process.exit(exitCode);
  }

  static async gracefulShutdown(
    context: string, 
    shutdownFn: () => Promise<void>
  ): Promise<void> {
    try {
      logger.info(`Starting graceful shutdown: ${context}`);
      await shutdownFn();
      logger.info(`Graceful shutdown completed: ${context}`);
      process.exit(0);
    } catch (error) {
      this.criticalExit(`Graceful shutdown failed - ${context}`, error);
    }
  }
}

// Resource Manager Class
export class ResourceManager {
  private resources = new Map<string, Resource>();

  register<T extends Resource>(name: string, resource: T): void {
    this.resources.set(name, resource);
  }

  get<T>(name: string): T {
    const resource = this.resources.get(name);
    if (!resource) {
      throw new Error(`Resource ${name} not found`);
    }
    return resource as T;
  }

  has(name: string): boolean {
    return this.resources.has(name);
  }

  private async closeResource(name: string, resource: Resource): Promise<void> {
    for (const method of CLOSE_METHODS) {
      if (typeof resource[method] === 'function') {
        try {
          await Promise.resolve(resource[method]());
          return;
        } catch (error) {
          logger.warn(`Failed to close resource ${name} with method ${method}:`, error);
        }
      }
    }
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.resources.entries()).map(
      ([name, resource]) => this.closeResource(name, resource)
    );

    try {
      await Promise.allSettled(closePromises);
      logger.info('All resources closed successfully');
    } catch (error) {
      logger.error('Error during resource cleanup:', error);
      throw error;
    }
  }

  setupGracefulShutdown(context = 'Server Resources'): void {
    SHUTDOWN_SIGNALS.forEach(signal => {
      process.on(signal, () => 
        ServerErrorHandler.gracefulShutdown(context, () => this.closeAll())
      );
    });
  }
}

// Configuration Helper Class
export class ConfigurationHelper {
  static getEnvironmentConfig<T>(
    defaultValue: T, 
    productionValue: T, 
    environment: NodeEnvironment
  ): T {
    return environment === 'production' ? productionValue : defaultValue;
  }

  static getSecureConfig(environment: NodeEnvironment): SecureConfig {
    const isProduction = environment === 'production';
    return {
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: isProduction ? DAY_IN_MS : 0
    };
  }
}

// Dynamic Import Helper Class
export class DynamicImportHelper {
  static resolveModule<T>(
    moduleToImport: unknown, 
    preferredStrategies: string[] = ['default', 'RedisStore']
  ): T {
    const strategies = [
      () => typeof moduleToImport === 'function' ? moduleToImport : null,
      ...preferredStrategies.map(strategy => 
        () => {
          const mod = moduleToImport as Record<string, unknown>;
          return typeof mod[strategy] === 'function' ? mod[strategy] : null;
        }
      )
    ];

    for (const strategy of strategies) {
      const resolved = strategy();
      if (resolved) return resolved as T;
    }

    throw new Error('No valid import strategy found');
  }
}

// Server Logger Class
export class ServerLogger {
  static serverStart(port: number, environment: NodeEnvironment): void {
    logger.info(`🚀 Server started on port ${port} [${environment}]`);
  }

  static developmentMode(): void {
    logger.warn('🛠️ Server running in development mode');
  }

  static serviceConnection(
    serviceName: string, 
    status: 'connected' | 'disconnected'
  ): void {
    const emoji = status === 'connected' ? '✅' : '❌';
    logger.info(`${emoji} Service ${serviceName}: ${status}`);
  }
}
