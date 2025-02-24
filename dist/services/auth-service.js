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
exports.AuthService = exports.CreateAccountSchema = exports.RecoverPasswordSchema = exports.LoginSchema = void 0;
const prisma_1 = __importDefault(require("./prisma"));
const bcrypt = __importStar(require("bcrypt"));
const z = __importStar(require("zod"));
const logger_1 = __importDefault(require("../config/logger"));
const crypto = __importStar(require("crypto"));
exports.LoginSchema = z.object({
    username: z.string()
        .min(3, 'Nome de usuário muito curto')
        .max(50, 'Nome de usuário muito longo')
        .trim()
        .toLowerCase(),
    password: z.string()
        .min(6, 'Senha muito curta')
        .max(100, 'Senha muito longa')
});
exports.RecoverPasswordSchema = z.object({
    email: z.string().email('E-mail inválido'),
    username: z.string().min(3, 'Nome de usuário muito curto')
});
exports.CreateAccountSchema = z.object({
    username: z.string()
        .min(3, 'Nome de usuário muito curto')
        .max(50, 'Nome de usuário muito longo')
        .regex(/^[a-zA-Z0-9_]+$/, 'Nome de usuário inválido'),
    email: z.string().email('E-mail inválido'),
    password: z.string()
        .min(8, 'Senha muito curta')
        .max(100, 'Senha muito longa')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais'),
    confirmPassword: z.string()
});
class AuthService {
    static async validateLogin(username, password) {
        const account = await prisma_1.default.account.findUnique({
            where: { username: username.toLowerCase() }
        });
        if (!account) {
            throw new Error('Usuário não encontrado');
        }
        const isPasswordValid = await bcrypt.compare(password, account.password);
        if (!isPasswordValid) {
            throw new Error('Senha incorreta');
        }
        return {
            id: account.id,
            username: account.username,
            email: account.email,
            role: account.role,
            isActive: account.isActive,
            lastLogin: account.lastLogin || new Date(),
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
        };
    }
    static async updateLastLogin(userId) {
        return prisma_1.default.account.update({
            where: { id: userId },
            data: { lastLogin: new Date() }
        });
    }
    static async recoverPassword(email, username) {
        const account = await prisma_1.default.account.findUnique({
            where: {
                username: username.toLowerCase(),
                email: email.toLowerCase()
            }
        });
        if (!account) {
            throw new Error('Conta não encontrada');
        }
        const token = await AuthService.generateRecoveryToken(account);
        await AuthService.sendRecoveryEmail(account, token);
        return true;
    }
    static async generateRecoveryToken(user) {
        const token = crypto.randomBytes(32).toString('hex');
        await prisma_1.default.passwordreset.create({
            data: {
                accountId: user.id,
                token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
        });
        return token;
    }
    static async sendRecoveryEmail(user, token) {
        logger_1.default.info(`[MOCK] E-mail de recuperação enviado para ${user.email} com token: ${token}`);
    }
    static async createAccount(data) {
        try {
            const { username, email, password, confirmPassword } = data;
            if (password !== confirmPassword) {
                throw new Error('Senhas não coincidem');
            }
            const existingAccount = await prisma_1.default.account.findFirst({
                where: {
                    OR: [
                        { username: username.toLowerCase() },
                        { email: email.toLowerCase() }
                    ]
                }
            });
            if (existingAccount) {
                throw new Error('Usuário ou e-mail já cadastrado');
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const account = await prisma_1.default.account.create({
                data: {
                    username: username.toLowerCase(),
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    role: 'USER',
                    isActive: true,
                    updatedAt: new Date()
                }
            });
            return account;
        }
        catch (error) {
            logger_1.default.error(`Erro ao criar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
            throw new Error(`Erro ao criar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        }
    }
}
exports.AuthService = AuthService;
