import prisma from './prisma';
import * as bcrypt from 'bcrypt';
import * as z from 'zod';
import logger from '../config/logger';
import * as crypto from 'crypto';

// Constants
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Types
interface AccountResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Validation Schemas
export const LoginSchema = z.object({
  username: z.string()
    .min(3, 'Nome de usuário muito curto')
    .max(50, 'Nome de usuário muito longo')
    .trim()
    .toLowerCase(),
  password: z.string()
    .min(6, 'Senha muito curta')
    .max(100, 'Senha muito longa')
});

export const RecoverPasswordSchema = z.object({
  email: z.string().email('E-mail inválido'),
  username: z.string().min(3, 'Nome de usuário muito curto')
});

export const CreateAccountSchema = z.object({
  username: z.string()
    .min(3, 'Nome de usuário muito curto')
    .max(50, 'Nome de usuário muito longo')
    .regex(/^[a-zA-Z0-9_]+$/, 'Nome de usuário inválido'),
  email: z.string().email('E-mail inválido'),
  password: z.string()
    .min(8, 'Senha muito curta')
    .max(100, 'Senha muito longa')
    .regex(PASSWORD_REGEX, 'Senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword']
});

export class AuthService {
  private static async findAccount(username: string, email?: string) {
    return prisma.account.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          ...(email ? [{ email: email.toLowerCase() }] : [])
        ]
      }
    });
  }

  static async validateLogin(username: string, password: string): Promise<AccountResponse> {
    const account = await this.findAccount(username);

    if (!account) {
      throw new Error('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);

    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas');
    }

    const { password: _, ...accountData } = account;
    return {
      ...accountData,
      lastLogin: account.lastLogin || new Date()
    };
  }

  static async updateLastLogin(userId: number) {
    try {
      return await prisma.account.update({
        where: { id: userId },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      logger.error(`Erro ao atualizar último login: ${error}`);
      throw new Error('Erro ao atualizar último login');
    }
  }

  static async recoverPassword(email: string, username: string): Promise<boolean> {
    const account = await this.findAccount(username, email);

    if (!account) {
      throw new Error('Conta não encontrada');
    }

    const token = await this.generateRecoveryToken(account);
    await this.sendRecoveryEmail(account, token);

    return true;
  }

  static async generateRecoveryToken(user: { id: number }): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    
    await prisma.passwordreset.create({
      data: {
        accountId: user.id,
        token,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY)
      }
    });

    return token;
  }

  static async sendRecoveryEmail(user: { email: string }, token: string): Promise<void> {
    // TODO: Implement actual email sending
    logger.info(`[MOCK] Recovery email sent to ${user.email} with token: ${token}`);
  }

  static async createAccount(data: z.infer<typeof CreateAccountSchema>) {
    try {
      const { username, email, password } = data;

      const existingAccount = await this.findAccount(username, email);

      if (existingAccount) {
        throw new Error('Usuário ou e-mail já cadastrado');
      }

      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      return await prisma.account.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'USER',
          isActive: true,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Erro ao criar conta:', error);
      throw new Error(error instanceof Error ? error.message : 'Erro ao criar conta');
    }
  }
}
