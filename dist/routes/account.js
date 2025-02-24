"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = accountRoutes;
const bcrypt = __importStar(require("bcrypt"));
const prisma_1 = __importDefault(require("../services/prisma"));
const fastify_custom_1 = require("../types/fastify-custom");
const auth_middleware_1 = require("../middleware/auth-middleware");
const logger_1 = __importDefault(require("../config/logger"));
const joi_1 = __importDefault(require("joi"));
const rate_limiter_1 = require("../utils/rate-limiter");
const auth_service_1 = require("../services/auth-service");
const render_helper_1 = require("../utils/render-helper");
const SALT_ROUNDS = 10;
const sendResponse = (reply, status, message, data) => {
    return reply.status(status).send({
        status,
        message,
        data
    });
};
async function checkExistingAccount(username, email) {
    return await prisma_1.default.account.findFirst({
        where: {
            OR: [
                { username },
                { email }
            ]
        }
    });
}
const CreateAccountJoiSchema = joi_1.default.object({
    username: joi_1.default.string().min(3).max(50).required(),
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().min(6).required()
});
const CreateAccountFastifySchema = {
    body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 }
        }
    }
};
const LoginJoiSchema = joi_1.default.object({
    username: joi_1.default.string().min(3).max(50).required(),
    password: joi_1.default.string().min(6).required()
});
const LoginFastifySchema = {
    body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
            username: { type: 'string', minLength: 3, maxLength: 50 },
            password: { type: 'string', minLength: 6 }
        }
    }
};
async function accountRoutes(fastify) {
    fastify.get('/create', async (request, reply) => {
        logger_1.default.info('Acessando a página de criação de conta');
        try {
            await (0, render_helper_1.renderPage)(reply, 'account-create', {
                title: 'Criar Conta',
                error: undefined
            });
            logger_1.default.info('Página de criação de conta renderizada com sucesso');
        }
        catch (error) {
            logger_1.default.error('Erro ao renderizar a página de criação de conta:', error);
            return reply.status(500).send('Erro interno ao renderizar a página de criação de conta');
        }
    });
    fastify.post('/create', {
        schema: CreateAccountFastifySchema
    }, async (request, reply) => {
        logger_1.default.info('Iniciando criação de conta');
        try {
            const { username, email, password } = request.body;
            logger_1.default.info('Dados da conta recebidos:', { username, email });
            const existingAccount = await checkExistingAccount(username, email);
            if (existingAccount) {
                logger_1.default.warn('Usuário ou email já cadastrado:', { username, email });
                return sendResponse(reply, 400, 'Usuário ou email já cadastrado. Tente novamente.');
            }
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            const newAccount = await prisma_1.default.account.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    role: 'USER',
                    isActive: true,
                    lastLogin: new Date(),
                    updatedAt: new Date(),
                },
                include: {}
            });
            logger_1.default.info(`Nova conta criada: ${username}`);
            return sendResponse(reply, 201, 'Conta criada com sucesso', newAccount);
        }
        catch (error) {
            logger_1.default.error('Erro na criação de conta:', error);
            return sendResponse(reply, 500, 'Erro interno ao criar conta');
        }
    });
    fastify.post('/login', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    username: { type: 'string' },
                    password: { type: 'string' }
                },
                required: ['username', 'password']
            }
        },
        preHandler: [
            auth_middleware_1.preventAuthenticatedAccess
        ]
    }, async (request, reply) => {
        const { username, password } = request.body;
        const canAttemptLogin = rate_limiter_1.RateLimiter.checkLoginAttempts(username, request);
        if (!canAttemptLogin) {
            return reply.status(429).send({ message: 'Too many login attempts. Please try again later.' });
        }
        try {
            const user = await auth_service_1.AuthService.validateLogin(username, password);
            if (!user) {
                return (0, render_helper_1.renderPage)(reply, 'login', {
                    title: 'Login',
                    error: 'Credenciais inválidas'
                });
            }
            request.session.user = user;
            return reply.redirect('/dashboard');
        }
        catch (error) {
            logger_1.default.error('Erro no login:', error);
            return (0, render_helper_1.renderPage)(reply, 'login', {
                title: 'Login',
                error: error instanceof Error ? error.message : 'Erro interno no servidor'
            });
        }
    });
    fastify.get('/login', {
        preHandler: [auth_middleware_1.preventAuthenticatedAccess]
    }, async (request, reply) => {
        try {
            return (0, render_helper_1.renderPage)(reply, 'login', {
                title: 'Login',
                error: request.query && typeof request.query === 'object' && 'error' in request.query
                    ? request.query.error
                    : undefined
            });
        }
        catch (error) {
            logger_1.default.error('Erro ao renderizar página de login', error);
            return sendResponse(reply, 500, 'Erro interno do servidor');
        }
    });
    fastify.get('/profile', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            const user = (0, fastify_custom_1.getSessionUser)(request);
            if (!user) {
                return reply.status(401).redirect('/login');
            }
            const account = await prisma_1.default.account.findUnique({
                where: { id: user.id },
                include: {
                    player: true
                }
            });
            if (!account) {
                return reply.status(404).view('pages/error', {
                    title: 'Perfil não encontrado',
                    message: 'Não foi possível encontrar os detalhes do perfil'
                });
            }
            return (0, render_helper_1.renderPage)(reply, 'profile', {
                title: 'Meu Perfil',
                account: account,
                player: account.player
            });
        }
        catch (error) {
            logger_1.default.error('Erro ao buscar perfil:', error);
            return reply.status(500).view('pages/error', {
                title: 'Erro',
                message: 'Erro interno ao carregar perfil'
            });
        }
    });
    fastify.put('/profile', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            const user = (0, fastify_custom_1.getSessionUser)(request);
            if (!user) {
                return reply.status(401).redirect('/login');
            }
            const { name, email } = request.body;
            const updatedAccount = await prisma_1.default.account.update({
                where: { id: user.id },
                data: {
                    email,
                    player: {
                        update: {
                            where: {
                                id: user.id
                            },
                            data: {
                                name: name
                            }
                        }
                    }
                },
                include: {
                    player: true
                }
            });
            const updatedSessionUser = {
                ...user,
                email: updatedAccount.email || user.email,
                updatedAt: new Date()
            };
            request.session.user = updatedSessionUser;
            logger_1.default.info(`Perfil atualizado: ${user.username}`);
            return (0, render_helper_1.renderPage)(reply, 'profile', {
                title: 'Meu Perfil',
                account: updatedAccount,
                player: updatedAccount.player,
                success: 'Perfil atualizado com sucesso!'
            });
        }
        catch (error) {
            logger_1.default.error('Erro ao atualizar perfil:', error);
            return reply.status(500).view('pages/error', {
                title: 'Erro',
                message: 'Erro interno ao atualizar perfil'
            });
        }
    });
    fastify.post('/recover-password', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    email: { type: 'string', format: 'email' }
                },
                required: ['email']
            }
        }
    }, async (request, reply) => {
        const { email } = request.body;
        try {
            const user = await prisma_1.default.account.findUnique({
                where: { email },
                include: {
                    player: true
                }
            });
            if (!user) {
                return sendResponse(reply, 404, 'Usuário não encontrado');
            }
            const recoveryToken = await auth_service_1.AuthService.generateRecoveryToken(user);
            await auth_service_1.AuthService.sendRecoveryEmail(user, recoveryToken);
            return sendResponse(reply, 200, 'E-mail de recuperação de senha enviado com sucesso');
        }
        catch (error) {
            logger_1.default.error('Erro ao enviar e-mail de recuperação de senha:', error);
            return sendResponse(reply, 500, 'Erro interno ao enviar e-mail de recuperação de senha');
        }
    });
}
