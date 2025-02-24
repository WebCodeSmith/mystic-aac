"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerLogger = exports.DynamicImportHelper = exports.ConfigurationHelper = exports.ResourceManager = exports.ServerErrorHandler = void 0;
const logger_1 = __importDefault(require("../config/logger"));
class ServerErrorHandler {
    static criticalExit(context, error, exitCode = 1) {
        logger_1.default.error(`[CRITICAL ERROR] ${context}:`, error instanceof Error ? error.message : String(error));
        if (!(error instanceof Error)) {
            logger_1.default.error('Erro não é uma instância de Error. Detalhes:', JSON.stringify(error));
        }
        process.exit(exitCode);
    }
    static gracefulShutdown(context, shutdownFn) {
        return async () => {
            try {
                logger_1.default.info(`Iniciando desligamento gracioso: ${context}`);
                await shutdownFn();
                logger_1.default.info(`Desligamento gracioso concluído: ${context}`);
                process.exit(0);
            }
            catch (error) {
                this.criticalExit(`Falha no desligamento gracioso - ${context}`, error);
            }
        };
    }
}
exports.ServerErrorHandler = ServerErrorHandler;
class ResourceManager {
    constructor() {
        this.resources = new Map();
    }
    register(name, resource) {
        this.resources.set(name, resource);
    }
    get(name) {
        const resource = this.resources.get(name);
        if (!resource) {
            throw new Error(`Recurso ${name} não encontrado`);
        }
        return resource;
    }
    hasResource(name) {
        return this.resources.has(name);
    }
    async closeAll() {
        const closeTasks = [];
        for (const [name, resource] of this.resources.entries()) {
            if (typeof resource === 'object' && resource !== null) {
                const closeMethodNames = ['close', 'quit', '$disconnect', 'disconnect'];
                for (const methodName of closeMethodNames) {
                    if (typeof resource[methodName] === 'function') {
                        try {
                            const closeTask = resource[methodName]();
                            if (closeTask instanceof Promise) {
                                closeTasks.push(closeTask);
                                break;
                            }
                        }
                        catch (error) {
                            console.warn(`Erro ao fechar recurso ${name} com método ${methodName}:`, error);
                        }
                    }
                }
            }
        }
        try {
            await Promise.allSettled(closeTasks);
            console.log('Todos os recursos fechados com sucesso');
        }
        catch (error) {
            console.error('Erro durante fechamento de recursos:', error);
            throw error;
        }
    }
    setupGracefulShutdown(context = 'Recursos do Servidor') {
        const signals = ['SIGINT', 'SIGTERM'];
        signals.forEach(signal => {
            process.on(signal, async () => {
                logger_1.default.info(`Recebido sinal ${signal}. Iniciando desligamento: ${context}`);
                try {
                    await this.closeAll();
                    logger_1.default.info(`Desligamento concluído: ${context}`);
                    process.exit(0);
                }
                catch (err) {
                    ServerErrorHandler.criticalExit(`Erro durante desligamento - ${context}`, err);
                }
            });
        });
    }
}
exports.ResourceManager = ResourceManager;
class ConfigurationHelper {
    static getEnvironmentConfig(defaultValue, productionValue, environment) {
        return environment === 'production' ? productionValue : defaultValue;
    }
    static getSecureConfig(environment) {
        return {
            secure: environment === 'production',
            sameSite: environment === 'production' ? 'strict' : 'lax',
            maxAge: environment === 'production' ? 86400000 : 0
        };
    }
}
exports.ConfigurationHelper = ConfigurationHelper;
class DynamicImportHelper {
    static resolveModule(moduleToImport, preferredImportStrategies = ['default', 'RedisStore']) {
        const importStrategies = [
            () => typeof moduleToImport === 'function' ? moduleToImport : null,
            ...preferredImportStrategies.map(strategy => () => typeof moduleToImport[strategy] === 'function'
                ? moduleToImport[strategy]
                : null)
        ];
        for (const strategy of importStrategies) {
            const resolvedModule = strategy();
            if (resolvedModule)
                return resolvedModule;
        }
        throw new Error('Nenhuma estratégia de importação válida encontrada');
    }
}
exports.DynamicImportHelper = DynamicImportHelper;
class ServerLogger {
    static serverStart(port, environment) {
        logger_1.default.info(`🚀 Servidor iniciado na porta ${port} [${environment}]`);
    }
    static developmentMode() {
        logger_1.default.warn('🛠️ Servidor rodando em modo de desenvolvimento');
    }
    static serviceConnection(serviceName, status) {
        const emoji = status === 'connected' ? '✅' : '❌';
        logger_1.default.info(`${emoji} Serviço ${serviceName}: ${status}`);
    }
}
exports.ServerLogger = ServerLogger;
