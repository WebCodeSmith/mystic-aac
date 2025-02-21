import logger from '../config/logger';

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
    logger.info(`🚀 Servidor iniciado`, {
      port,
      environment,
      timestamp: new Date().toISOString()
    });
  }

  static developmentMode() {
    logger.info('🛠️ Modo de desenvolvimento ativado', {
      timestamp: new Date().toISOString()
    });
  }

  static serviceConnection(serviceName: string, status: 'connected' | 'disconnected') {
    logger[status === 'connected' ? 'info' : 'warn'](`Serviço ${serviceName}`, {
      status,
      timestamp: new Date().toISOString()
    });
  }
}
