import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimitOptions, errorResponseBuilderContext } from '@fastify/rate-limit';
import logger from '../config/logger';

// Constantes
const MAX_LOGIN_ATTEMPTS = 10;
const BLOCK_DURATION_MINUTES = 30;
const AUTHENTICATED_USER_PREFIX = 'user:';
const DEFAULT_IP = '127.0.0.1';

// Tipos
interface LoginAttempt {
  attempts: number;
  lastAttempt: number;
}

interface RateLimitContext {
  max: number;
  current: number;
  remaining: number;
  reset: number;
}

// Cache de tentativas de login usando WeakMap para melhor performance
const loginAttempts = new Map<string, LoginAttempt>();

// Configurações do limitador de API
export const apiLimiter: RateLimitOptions = {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request: FastifyRequest) => {
    const sessionUser = request.session?.user;
    return sessionUser?.id 
      ? `${AUTHENTICATED_USER_PREFIX}${sessionUser.id}` 
      : request.ip || DEFAULT_IP;
  },
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Limite de 100 requisições por minuto excedido. Por favor, aguarde um momento.'
  })
};

// Configurações do limitador de login
export const loginLimiter: RateLimitOptions = {
  max: MAX_LOGIN_ATTEMPTS,
  timeWindow: `${BLOCK_DURATION_MINUTES} minutes`,
  keyGenerator: (request: FastifyRequest) => request.ip || DEFAULT_IP,
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Limite de ${MAX_LOGIN_ATTEMPTS} tentativas de login por ${BLOCK_DURATION_MINUTES} minutos excedido.`
  })
};

export class RateLimiter {
  private static isUserAuthenticated(request: FastifyRequest): boolean {
    return !!request.session?.user;
  }

  private static getCurrentTime(): number {
    return Date.now();
  }

  static checkLoginAttempts(username: string, request: FastifyRequest): boolean {
    if (this.isUserAuthenticated(request)) {
      return true;
    }

    const currentTime = this.getCurrentTime();
    const userAttempts = loginAttempts.get(username);

    if (!userAttempts) {
      loginAttempts.set(username, { attempts: 1, lastAttempt: currentTime });
      return true;
    }

    const { attempts, lastAttempt } = userAttempts;
    const timeElapsed = currentTime - lastAttempt;
    const blockDurationMs = BLOCK_DURATION_MINUTES * 60 * 1000;

    if (timeElapsed < blockDurationMs) {
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        return false;
      }
      loginAttempts.set(username, { 
        attempts: attempts + 1, 
        lastAttempt: currentTime 
      });
      return true;
    }

    loginAttempts.set(username, { attempts: 1, lastAttempt: currentTime });
    return true;
  }

  static getRemainingBlockTime(username: string): number {
    const userAttempts = loginAttempts.get(username);
    if (!userAttempts) return 0;

    const elapsedTime = this.getCurrentTime() - userAttempts.lastAttempt;
    const remainingTime = (BLOCK_DURATION_MINUTES * 60 * 1000) - elapsedTime;

    return Math.max(0, Math.ceil(remainingTime / (60 * 1000)));
  }

  static clearLoginAttempts(username: string): void {
    loginAttempts.delete(username);
  }
}
