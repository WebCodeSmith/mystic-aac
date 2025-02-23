import prisma from './prisma';
import * as bcrypt from 'bcrypt';
import * as z from 'zod';
import logger from '../config/logger';
import * as crypto from 'crypto';

// Esquemas de validação
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
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais'),
  confirmPassword: z.string()
});

export class AuthService {
  static async validateLogin(username: string, password: string) {
    const account = await prisma.account.findUnique({
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

  static async updateLastLogin(userId: number) {
    return prisma.account.update({
      where: { id: userId },
      data: { lastLogin: new Date() }
    });
  }

  static async recoverPassword(email: string, username: string) {
    const account = await prisma.account.findUnique({
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

  static async generateRecoveryToken(user: any): Promise<string> {
    // Gerar um token único para recuperação de senha
    const token = crypto.randomBytes(32).toString('hex');
    
    // Salvar o token no banco de dados com expiração
    await prisma.PasswordReset.create({
      data: {
        accountId: user.id,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
      }
    });

    return token;
  }

  static async sendRecoveryEmail(user: any, token: string): Promise<void> {
    // TODO: Implementar o envio real de e-mail
    logger.info(`[MOCK] E-mail de recuperação enviado para ${user.email} com token: ${token}`);
  }

  static async createAccount(data: z.infer<typeof CreateAccountSchema>) {
    try {
      const { username, email, password, confirmPassword } = data;

      if (password !== confirmPassword) {
        throw new Error('Senhas não coincidem');
      }

      const existingAccount = await prisma.account.findFirst({
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

      return await prisma.account.create({
        data: {
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password: hashedPassword,
          role: 'USER',
          isActive: true
        }
      });
    } catch (error: unknown) {
      logger.error(`Erro ao criar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      throw new Error(`Erro ao criar conta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }
}
