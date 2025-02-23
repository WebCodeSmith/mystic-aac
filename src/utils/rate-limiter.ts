import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitOptions, errorResponseBuilderContext } from '@fastify/rate-limit';
import logger from '../config/logger';

// Tipo personalizado para o contexto do rate limiter
interface RateLimitContext {
  max: number;
  current: number;
  remaining: number;
  reset: number;
}

// Constantes de rate limiting
const MAX_LOGIN_ATTEMPTS = 10;
const BLOCK_DURATION_MINUTES = 30;

// Mapa de tentativas de login
const loginAttempts = new Map<string, { attempts: number, lastAttempt: number }>();

// Constante para usuário autenticado
const AUTHENTICATED_USER_PREFIX = 'user:';

export const apiLimiter: RateLimitOptions = {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest) => {
    // Gerar chave de limite de taxa baseada no IP ou usuário autenticado
    const sessionUser = request.session && typeof request.session === 'object' 
      ? (request.session as any).user 
      : undefined;

    return sessionUser?.id 
      ? `${AUTHENTICATED_USER_PREFIX}${sessionUser.id}` 
      : request.ip || '127.0.0.1';
  },
  errorResponseBuilder: (request: FastifyRequest, context: errorResponseBuilderContext) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Limite de 100 requisições por minuto excedido. Por favor, aguarde um momento.`
    };
  }
};

// Exportar o loginLimiter
export const loginLimiter: RateLimitOptions = {
  max: 10,
  timeWindow: '30 minutes',
  keyGenerator: (request: FastifyRequest) => {
    return request.ip || '127.0.0.1';
  },
  errorResponseBuilder: (request: FastifyRequest, context: errorResponseBuilderContext) => {
    return {
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Limite de 10 tentativas de login por 30 minutos excedido. Tente novamente mais tarde.`
    };
  }
};

export class RateLimiter {
  /**
   * Verifica e registra tentativas de login
   * @param username Nome de usuário para verificação
   * @param request Requisição atual
   * @returns true se login pode ser tentado, false se bloqueado
   */
  static checkLoginAttempts(username: string, request: FastifyRequest): boolean {
    const sessionUser = request.session && typeof request.session === 'object' 
      ? (request.session as any).user 
      : undefined;

    // Log para verificar se o usuário está autenticado
    logger.warn('Usuário autenticado:', sessionUser);

    // Se o usuário está autenticado, não contar tentativas de login
    if (sessionUser) {
      logger.warn('Usuário autenticado, permitindo login sem contagem.');
      logger.warn('Autenticação bem-sucedida para o usuário:', username);
      return true; // Usuário autenticado, não conta como tentativa
    }

    // Lógica existente para contar tentativas de login
    const currentTime = Date.now();
    const userAttempts = loginAttempts.get(username);
    if (userAttempts) {
      const { attempts, lastAttempt } = userAttempts;
      logger.warn(`Tentativas de login para ${username}: ${attempts}, Última tentativa: ${lastAttempt}`);
      logger.warn(`Tentativa de login número ${attempts + 1} para o usuário ${username}`);
      if (currentTime - lastAttempt < BLOCK_DURATION_MINUTES * 60 * 1000) {
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
          logger.warn('Bloqueado por muitas tentativas.');
          logger.warn(`Usuário ${username} bloqueado por ${BLOCK_DURATION_MINUTES} minutos`);
          return false; // Bloqueado
        }
        loginAttempts.set(username, { attempts: attempts + 1, lastAttempt: currentTime });
        logger.warn(`Tentativa de login permitida para o usuário ${username}`);
        return true; // Permitir tentativa
      }
    }
    // Se não houver tentativas registradas ou se o tempo de bloqueio tiver expirado
    loginAttempts.set(username, { attempts: 1, lastAttempt: currentTime });
    logger.warn(`Primeira tentativa de login para o usuário ${username}`);
    return true;
  }

  /**
   * Obtém o tempo restante de bloqueio
   * @param username Nome de usuário
   * @returns Minutos restantes de bloqueio
   */
  static getRemainingBlockTime(username: string): number {
    const now = Date.now();
    const userAttempts = loginAttempts.get(username);

    if (!userAttempts) return 0;

    const elapsedTime = now - userAttempts.lastAttempt;
    const remainingTime = (BLOCK_DURATION_MINUTES * 60 * 1000) - elapsedTime;

    // Converter para minutos e arredondar para cima
    return Math.ceil(remainingTime / (60 * 1000));
  }

  /**
   * Limpa as tentativas de login para um usuário específico
   * @param username Nome de usuário
   */
  static clearLoginAttempts(username: string): void {
    loginAttempts.delete(username);
  }
}
