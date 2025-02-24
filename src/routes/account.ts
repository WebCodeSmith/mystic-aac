import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as bcrypt from 'bcrypt';
import prisma from '../services/prisma';
import { User } from '../types/fastify-session';
import { getSessionUser } from '../types/fastify-custom';
import { requireAuth, preventAuthenticatedAccess } from '../middleware/auth-middleware';
import logger from '../config/logger';
import Joi from 'joi';
import { RateLimiter } from '../utils/rate-limiter';
import { AuthService } from '../services/auth-service';
import { renderPage } from '../utils/render-helper';

// Interfaces
interface CreateAccountBody {
  username: string;
  email: string;
  password: string;
}

interface LoginBody {
  username: string;
  password: string;
}

interface UpdateProfileBody {
  name?: string;
  email?: string;
}

// Constantes
const CONSTANTS = {
  SALT_ROUNDS: 10,
  MIN_USERNAME_LENGTH: 3,
  MAX_USERNAME_LENGTH: 50,
  MIN_PASSWORD_LENGTH: 6,
  DEFAULT_ROLE: 'USER'
} as const;

// Helper para padronizar respostas
const sendResponse = (reply: FastifyReply, status: number, message: string, data?: any) => {
  return reply.status(status).send({
    status,
    message,
    data
  });
};

// Helper Functions
async function checkExistingAccount(username: string, email: string) {
  return prisma.account.findFirst({
    where: {
      OR: [
        { username },
        { email }
      ]
    },
    select: {
      id: true,
      username: true,
      email: true
    }
  });
}

const sendAccountError = (reply: FastifyReply, status: number, message: string) => {
  logger.error(`Account Error: ${message}`);
  return reply.status(status).view('pages/error', {
    title: 'Erro',
    message
  });
};

// Esquema de validação para criação de conta usando Joi
const CreateAccountJoiSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

// Esquema de validação para criação de conta para Fastify
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

// Esquema de validação para login usando Joi
const LoginJoiSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).required()
});

// Esquema de validação para login para Fastify
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

// Plugin de rotas de conta
export default async function accountRoutes(fastify: FastifyInstance) {
  // Criar Conta
  fastify.get('/create', async (_request, reply) => {
    return renderPage(reply, 'account-create', { 
      title: 'Criar Conta'
    });
  });

  fastify.post<{ Body: CreateAccountBody }>('/create', 
    { schema: CreateAccountFastifySchema },
    async (request, reply) => {
      const { username, email, password } = request.body;
  
      try {
        const existingAccount = await checkExistingAccount(username, email);
        if (existingAccount) {
          return sendAccountError(reply, 400, 'Usuário ou email já cadastrado');
        }
  
        const hashedPassword = await bcrypt.hash(password, CONSTANTS.SALT_ROUNDS);
        const currentDate = new Date();
        
        const newAccount = await prisma.account.create({
          data: {
            username,
            email,
            password: hashedPassword,
            role: CONSTANTS.DEFAULT_ROLE,
            isActive: true,
            lastLogin: currentDate,
            updatedAt: currentDate, // Adicionando o campo obrigatório
            createdAt: currentDate  // Opcional, mas bom ter para consistência
          }
        });
  
        return reply.redirect('/login?success=account-created');
      } catch (error) {
        return sendAccountError(reply, 500, 'Erro ao criar conta');
      }
    }
  );

  // Login
  fastify.post<{ Body: LoginBody }>('/login',
    { 
      schema: LoginFastifySchema,
      preHandler: [preventAuthenticatedAccess]
    },
    async (request, reply) => {
      const { username, password } = request.body;

      if (!RateLimiter.checkLoginAttempts(username, request)) {
        return sendAccountError(reply, 429, 'Muitas tentativas de login. Tente novamente mais tarde.');
      }

      try {
        const user = await AuthService.validateLogin(username, password);
        if (!user) {
          return renderPage(reply, 'login', { 
            title: 'Login', 
            error: 'Credenciais inválidas' 
          });
        }

        request.session.user = user;
        RateLimiter.clearLoginAttempts(username);
        return reply.redirect('/dashboard');
      } catch (error) {
        return sendAccountError(reply, 500, 'Erro ao realizar login');
      }
    }
  );

  // Rota para exibir a página de login
  fastify.get('/login', 
  { 
    preHandler: [preventAuthenticatedAccess]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return renderPage(reply, 'login', {
        title: 'Login',
        error: request.query && typeof request.query === 'object' && 'error' in request.query 
          ? request.query.error as string 
          : undefined
      });
    } catch (error) {
      logger.error('Erro ao renderizar página de login', error);
      return sendResponse(reply, 500, 'Erro interno do servidor');
    }
  });

  // Rota para exibir perfil do usuário
  fastify.get('/profile', 
    { 
      preHandler: [requireAuth] 
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getSessionUser(request);

        if (!user) {
          return reply.status(401).redirect('/login');
        }

        const account = await prisma.account.findUnique({
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

        return renderPage(reply, 'profile', {
          title: 'Meu Perfil',
          account: account,
          player: account.player
        });

      } catch (error) {
        logger.error('Erro ao buscar perfil:', error);
        return reply.status(500).view('pages/error', {
          title: 'Erro',
          message: 'Erro interno ao carregar perfil'
        });
      }
    }
  );

  // Rota para atualizar perfil
  fastify.put('/profile', 
    { 
      preHandler: [requireAuth] 
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getSessionUser(request);

        if (!user) {
          return reply.status(401).redirect('/login');
        }

        const { name, email } = request.body as UpdateProfileBody;

        const updatedAccount = await prisma.account.update({
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

        // Atualizar usuário na sessão
        const updatedSessionUser = {
          ...user,
          email: updatedAccount.email || user.email,
          updatedAt: new Date()
        };

        request.session.user = updatedSessionUser;

        logger.info(`Perfil atualizado: ${user.username}`);

        return renderPage(reply, 'profile', {
          title: 'Meu Perfil',
          account: updatedAccount,
          player: updatedAccount.player,
          success: 'Perfil atualizado com sucesso!'
        });

      } catch (error) {
        logger.error('Erro ao atualizar perfil:', error);
        return reply.status(500).view('pages/error', {
          title: 'Erro',
          message: 'Erro interno ao atualizar perfil'
        });
      }
    }
  );

  // Rota de recuperação de senha
  fastify.post('/recover-password', 
    { 
      schema: {
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' }
          },
          required: ['email']
        }
      }
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { email } = request.body as { email: string };

      try {
        const user = await prisma.account.findUnique({
          where: { email },
          include: {
            player: true
          }
        });

        if (!user) {
          return sendResponse(reply, 404, 'Usuário não encontrado');
        }

        // Enviar e-mail de recuperação de senha
        const recoveryToken = await AuthService.generateRecoveryToken(user);
        await AuthService.sendRecoveryEmail(user, recoveryToken);

        return sendResponse(reply, 200, 'E-mail de recuperação de senha enviado com sucesso');
      } catch (error) {
        logger.error('Erro ao enviar e-mail de recuperação de senha:', error);
        return sendResponse(reply, 500, 'Erro interno ao enviar e-mail de recuperação de senha');
      }
    }
  );
}
