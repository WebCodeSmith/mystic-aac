import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as bcrypt from 'bcrypt';
import prisma from '../services/prisma';
import { User } from '../types/fastify-session';
import { requireAuth, preventAuthenticatedAccess } from '../middleware/auth-middleware';
import logger from '../config/logger';
import Joi from 'joi';
import { RateLimiter } from '../utils/rate-limiter';
import { AuthService } from '../services/auth-service';
import { renderPage } from '../utils/render-helper';

// Constantes
const SALT_ROUNDS = 10;

// Helper para padronizar respostas
const sendResponse = (reply: FastifyReply, status: number, message: string, data?: any) => {
  return reply.status(status).send({
    status,
    message,
    data
  });
};

// Função para verificar se o usuário ou email já existem
async function checkExistingAccount(username: string, email: string) {
  return await prisma.account.findFirst({
    where: {
      OR: [
        { username },
        { email }
      ]
    }
  });
}

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
  // Rota para exibir a página de criação de conta
  fastify.get('/create', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info('Acessando a página de criação de conta');
    try {
      await renderPage(reply, 'account-create', { 
        title: 'Criar Conta', 
        error: undefined 
      });
      logger.info('Página de criação de conta renderizada com sucesso');
    } catch (error) {
      logger.error('Erro ao renderizar a página de criação de conta:', error);
      return reply.status(500).send('Erro interno ao renderizar a página de criação de conta');
    }
  });

  // Rota para processar a criação de conta
  fastify.post('/create', 
    { 
      schema: CreateAccountFastifySchema 
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      logger.info('Iniciando criação de conta');
      try {
        const { username, email, password } = request.body as { 
          username: string, 
          email: string, 
          password: string 
        };

        logger.info('Dados da conta recebidos:', { username, email });

        // Verificar se usuário ou email já existem
        const existingAccount = await checkExistingAccount(username, email);

        if (existingAccount) {
          logger.warn('Usuário ou email já cadastrado:', { username, email });
          return sendResponse(reply, 400, 'Usuário ou email já cadastrado. Tente novamente.');
        }

        // Hash da senha
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Criar conta
        const newAccount = await prisma.account.create({
          data: {
            username,
            email,
            password: hashedPassword,
            role: 'USER', // Papel padrão
            isActive: true,
            lastLogin: new Date(),
            Player: {
              create: {
                name: username,
                level: 1,
                experience: 0,
                vocation: 'Rookie', // Valor padrão para vocation
              },
            },
          },
          include: {
            Player: true
          }
        });

        // Converter BigInt para Number ou String antes de enviar a resposta
        const responseAccount = {
          ...newAccount,
          Player: newAccount.Player ? {
            ...newAccount.Player,
            level: Number(newAccount.Player.level),
            experience: Number(newAccount.Player.experience),
          } : null,
        };

        logger.info(`Nova conta criada: ${username}`);
        return sendResponse(reply, 201, 'Conta criada com sucesso', responseAccount);

      } catch (error) {
        logger.error('Erro na criação de conta:', error);
        return sendResponse(reply, 500, 'Erro interno ao criar conta');
      }
    }
  );

    // Rota de login
    fastify.post('/login', 
      { 
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
          preventAuthenticatedAccess
        ]
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { username, password } = request.body as { username: string; password: string };  
  
        // Verificar tentativas de login
        const canAttemptLogin = RateLimiter.checkLoginAttempts(username, request);
        if (!canAttemptLogin) {
          return reply.status(429).send({ message: 'Too many login attempts. Please try again later.' });
        }
  
        try {
          const user = await AuthService.validateLogin(username, password);
          if (!user) {
            return renderPage(reply, 'login', { 
              title: 'Login', 
              error: 'Credenciais inválidas' 
            });
          }
  
          // Criar sessão
          request.session.user = user;
  
          return reply.redirect('/dashboard');
        } catch (error) {
          logger.error('Erro no login:', error);
          return renderPage(reply, 'login', { 
            title: 'Login', 
            error: error instanceof Error ? error.message : 'Erro interno no servidor'
          });
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
        const user: User | undefined = getSessionUser(request);

        if (!user) {
          return reply.status(401).redirect('/login');
        }

        const account = await prisma.account.findUnique({
          where: { id: user.id },
          include: {
            Player: true
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
          player: account.Player
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
        const user: User | undefined = getSessionUser(request);

        if (!user) {
          return reply.status(401).redirect('/login');
        }

        const { name, email } = request.body as { 
          name?: string, 
          email?: string 
        };

        const updatedAccount = await prisma.account.update({
          where: { id: user.id },
          data: {
            email,
            Player: {
              update: {
                name
              }
            }
          },
          include: {
            Player: true
          }
        });

        // Atualizar usuário na sessão
        const updatedSessionUser: User = {
          ...user,
          email: updatedAccount.email || user.email,
          updatedAt: new Date()
        };

        request.session.user = updatedSessionUser;

        logger.info(`Perfil atualizado: ${user.username}`);

        return renderPage(reply, 'profile', {
          title: 'Meu Perfil',
          account: updatedAccount,
          player: updatedAccount.Player,
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
            Player: true
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

function getSessionUser(request: FastifyRequest): User | undefined {
  return request.session && typeof request.session === 'object' 
    ? (request.session as any).user 
    : undefined;
}
