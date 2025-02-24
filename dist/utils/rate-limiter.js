"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = exports.loginLimiter = exports.apiLimiter = void 0;
const logger_1 = __importDefault(require("../config/logger"));
const MAX_LOGIN_ATTEMPTS = 10;
const BLOCK_DURATION_MINUTES = 30;
const loginAttempts = new Map();
const AUTHENTICATED_USER_PREFIX = 'user:';
exports.apiLimiter = {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
        const sessionUser = request.session && typeof request.session === 'object'
            ? request.session.user
            : undefined;
        return sessionUser?.id
            ? `${AUTHENTICATED_USER_PREFIX}${sessionUser.id}`
            : request.ip || '127.0.0.1';
    },
    errorResponseBuilder: (request, context) => {
        return {
            statusCode: 429,
            error: 'Too Many Requests',
            message: `Limite de 100 requisições por minuto excedido. Por favor, aguarde um momento.`
        };
    }
};
exports.loginLimiter = {
    max: 10,
    timeWindow: '30 minutes',
    keyGenerator: (request) => {
        return request.ip || '127.0.0.1';
    },
    errorResponseBuilder: (request, context) => {
        return {
            statusCode: 429,
            error: 'Too Many Requests',
            message: `Limite de 10 tentativas de login por 30 minutos excedido. Tente novamente mais tarde.`
        };
    }
};
class RateLimiter {
    static checkLoginAttempts(username, request) {
        const sessionUser = request.session && typeof request.session === 'object'
            ? request.session.user
            : undefined;
        logger_1.default.warn('Usuário autenticado:', sessionUser);
        if (sessionUser) {
            logger_1.default.warn('Usuário autenticado, permitindo login sem contagem.');
            logger_1.default.warn('Autenticação bem-sucedida para o usuário:', username);
            return true;
        }
        const currentTime = Date.now();
        const userAttempts = loginAttempts.get(username);
        if (userAttempts) {
            const { attempts, lastAttempt } = userAttempts;
            logger_1.default.warn(`Tentativas de login para ${username}: ${attempts}, Última tentativa: ${lastAttempt}`);
            logger_1.default.warn(`Tentativa de login número ${attempts + 1} para o usuário ${username}`);
            if (currentTime - lastAttempt < BLOCK_DURATION_MINUTES * 60 * 1000) {
                if (attempts >= MAX_LOGIN_ATTEMPTS) {
                    logger_1.default.warn('Bloqueado por muitas tentativas.');
                    logger_1.default.warn(`Usuário ${username} bloqueado por ${BLOCK_DURATION_MINUTES} minutos`);
                    return false;
                }
                loginAttempts.set(username, { attempts: attempts + 1, lastAttempt: currentTime });
                logger_1.default.warn(`Tentativa de login permitida para o usuário ${username}`);
                return true;
            }
        }
        loginAttempts.set(username, { attempts: 1, lastAttempt: currentTime });
        logger_1.default.warn(`Primeira tentativa de login para o usuário ${username}`);
        return true;
    }
    static getRemainingBlockTime(username) {
        const now = Date.now();
        const userAttempts = loginAttempts.get(username);
        if (!userAttempts)
            return 0;
        const elapsedTime = now - userAttempts.lastAttempt;
        const remainingTime = (BLOCK_DURATION_MINUTES * 60 * 1000) - elapsedTime;
        return Math.ceil(remainingTime / (60 * 1000));
    }
    static clearLoginAttempts(username) {
        loginAttempts.delete(username);
    }
}
exports.RateLimiter = RateLimiter;
