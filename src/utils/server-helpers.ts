import logger from '../config/logger';
import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

// Tipos de ambiente
export type NodeEnvironment = 'development' | 'production' | 'test';

// Utilitário de tratamento de erros centralizado
export class ServerErrorHandler {
  static criticalExit(context: string, error: unknown, exitCode = 1): never {
    logger.error(`[CRITICAL ERROR] ${context}:`, error instanceof Error ? error.message : String(error));
    
    // Log adicional para erros desconhecidos
    if (!(error instanceof Error)) {
      logger.error('Erro não é uma instância de Error. Detalhes:', JSON.stringify(error));
    }

    // Desligar o processo com código de erro
    process.exit(exitCode);
  }

  static gracefulShutdown(context: string, shutdownFn: () => Promise<void>) {
    return async () => {
      try {
        logger.info(`Iniciando desligamento gracioso: ${context}`);
        await shutdownFn();
        logger.info(`Desligamento gracioso concluído: ${context}`);
        process.exit(0);
      } catch (error) {
        this.criticalExit(`Falha no desligamento gracioso - ${context}`, error);
      }
    };
  }
}

// Utilitário de gerenciamento de recursos
export class ResourceManager {
  private resources: Map<string, any> = new Map();

  register(name: string, resource: any) {
    this.resources.set(name, resource);
  }

  // Método público para recuperar recursos
  public get<T>(name: string): T {
    const resource = this.resources.get(name);
    if (!resource) {
      throw new Error(`Recurso ${name} não encontrado`);
    }
    return resource;
  }

  // Método para verificar se um recurso existe
  public hasResource(name: string): boolean {
    return this.resources.has(name);
  }

  // Método genérico para fechar recursos
  async closeAll() {
    const closeTasks: Promise<void>[] = [];

    // Iterar sobre todos os recursos registrados
    for (const [name, resource] of this.resources.entries()) {
      if (typeof resource === 'object' && resource !== null) {
        // Verificar métodos de fechamento comuns
        const closeMethodNames = ['close', 'quit', '$disconnect', 'disconnect'];
        
        for (const methodName of closeMethodNames) {
          if (typeof (resource as any)[methodName] === 'function') {
            try {
              const closeTask = (resource as any)[methodName]();
              if (closeTask instanceof Promise) {
                closeTasks.push(closeTask);
                break; // Parar após encontrar o primeiro método válido
              }
            } catch (error) {
              console.warn(`Erro ao fechar recurso ${name} com método ${methodName}:`, error);
            }
          }
        }
      }
    }

    try {
      await Promise.allSettled(closeTasks);
      console.log('Todos os recursos fechados com sucesso');
    } catch (error) {
      console.error('Erro durante fechamento de recursos:', error);
      throw error;
    }
  }

  setupGracefulShutdown(context: string = 'Recursos do Servidor') {
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Recebido sinal ${signal}. Iniciando desligamento: ${context}`);
        try {
          await this.closeAll();
          logger.info(`Desligamento concluído: ${context}`);
          process.exit(0);
        } catch (err) {
          ServerErrorHandler.criticalExit(`Erro durante desligamento - ${context}`, err);
        }
      });
    });
  }
}

// Utilitário de configuração condicional
export class ConfigurationHelper {
  static getEnvironmentConfig<T>(
    defaultValue: T, 
    productionValue: T, 
    environment: NodeEnvironment
  ): T {
    return environment === 'production' ? productionValue : defaultValue;
  }

  static getSecureConfig(environment: NodeEnvironment) {
    return {
      secure: environment === 'production',
      sameSite: environment === 'production' ? 'strict' as const : 'lax' as const,
      maxAge: environment === 'production' ? 86400000 : 0 // 1 dia em produção
    };
  }
}

// Helper para importação dinâmica
export class DynamicImportHelper {
  static resolveModule(moduleToImport: any, preferredImportStrategies: string[] = ['default', 'RedisStore']) {
    // Estratégias de importação
    const importStrategies = [
      () => typeof moduleToImport === 'function' ? moduleToImport : null,
      ...preferredImportStrategies.map(strategy => 
        () => typeof (moduleToImport as any)[strategy] === 'function' 
          ? (moduleToImport as any)[strategy] 
          : null
      )
    ];

    // Tentar cada estratégia
    for (const strategy of importStrategies) {
      const resolvedModule = strategy();
      if (resolvedModule) return resolvedModule;
    }

    throw new Error('Nenhuma estratégia de importação válida encontrada');
  }
}

// Utilitário de logging padronizado
export class ServerLogger {
  static serverStart(port: number, environment: NodeEnvironment) {
    logger.info(`🚀 Servidor iniciado na porta ${port} [${environment}]`);
  }

  static developmentMode() {
    logger.warn('🛠️ Servidor rodando em modo de desenvolvimento');
  }

  static serviceConnection(serviceName: string, status: 'connected' | 'disconnected') {
    const emoji = status === 'connected' ? '✅' : '❌';
    logger.info(`${emoji} Serviço ${serviceName}: ${status}`);
  }
}
