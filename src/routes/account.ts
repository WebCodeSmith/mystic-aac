import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as bcrypt from 'bcrypt';
import prisma from '../services/prisma';
import { User } from '../types/express-session';
import { requireAuth } from '../middleware/auth-middleware';
import { preventAuthenticatedAccess } from '../middleware/auth-middleware';
import logger from '../config/logger';

// Esquema de validação para criação de conta
const CreateAccountSchema = {
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

// Esquema de validação para login
const LoginSchema = {
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
    reply.view('pages/account-create', { 
      title: 'Criar Conta', 
      error: null 
    });
  });

  // Rota para processar a criação de conta
  fastify.post('/create', 
    { 
      schema: CreateAccountSchema 
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { username, email, password } = request.body as { 
          username: string, 
          email: string, 
          password: string 
        };

        // Verificar se usuário ou email já existem
        const existingAccount = await prisma.account.findFirst({
          where: {
            OR: [
              { username },
              { email }
            ]
          }
        });

        if (existingAccount) {
          return reply.view('pages/account-create', { 
            title: 'Criar Conta', 
            error: 'Usuário ou email já cadastrado' 
          });
        }

        // Hash da senha
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

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
                vocation: 'Rookie', // Adicionado vocation padrão
              }
            }
          },
          include: {
            Player: true
          }
        });

        logger.info(`Nova conta criada: ${username}`);

        // Redirecionar para login com mensagem de sucesso
        return reply.view('pages/login', { 
          title: 'Login', 
          success: 'Conta criada com sucesso! Faça login para continuar.' 
        });

      } catch (error) {
        logger.error('Erro na criação de conta:', error);
        return reply.view('pages/account-create', { 
          title: 'Criar Conta', 
          error: 'Erro interno ao criar conta' 
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
      return reply.view('pages/login', {
        title: 'Login',
        error: request.query && typeof request.query === 'object' && 'error' in request.query 
          ? request.query.error as string 
          : undefined
      });
    } catch (error) {
      logger.error('Erro ao renderizar página de login', error);
      return reply.status(500).send('Erro interno do servidor');
    }
  });

  // Rota para processar o login
  fastify.post('/login', 
    { 
      schema: LoginSchema 
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { username, password } = request.body as { 
          username: string, 
          password: string 
        };

        // Buscar usuário
        const account = await prisma.account.findUnique({
          where: { username }
        });

        if (!account) {
          return reply.view('pages/login', { 
            title: 'Login', 
            error: 'Usuário não encontrado' 
          });
        }

        // Verificar senha
        const isPasswordValid = await bcrypt.compare(password, account.password);

        if (!isPasswordValid) {
          return reply.view('pages/login', { 
            title: 'Login', 
            error: 'Senha incorreta' 
          });
        }

        // Verificação de sessão com tratamento detalhado
        return new Promise<void>((resolve, reject) => {
          // Verificação explícita da sessão
          if (!request.session) {
            logger.error('Sessão não inicializada');
            return reply.status(500).view('pages/error', {
              title: 'Erro de Sessão',
              message: 'Não foi possível iniciar a sessão. Tente novamente.'
            });
          }

          // Regenerar sessão de forma segura
          request.session.regenerate(async (err: Error | null) => {
            if (err) {
              logger.error('Erro ao regenerar sessão', {
                error: err.message,
                stack: err.stack
              });
              return reply.status(500).view('pages/error', {
                title: 'Erro de Sessão',
                message: 'Não foi possível iniciar a sessão. Tente novamente.'
              });
            }

            // Preparar dados do usuário para sessão
            const sessionUser: User = {
              id: account.id,
              username: account.username,
              email: account.email,
              role: account.role,
              isActive: account.isActive,
              lastLogin: account.lastLogin || new Date(),
              createdAt: account.createdAt,
              updatedAt: account.updatedAt
            };

            // Atualizar sessão e último login
            (request.session as any).user = sessionUser;
            
            try {
              // Atualizar último login no banco de dados
              await prisma.account.update({
                where: { id: account.id },
                data: { lastLogin: new Date() }
              });

              logger.info('Login realizado com sucesso', {
                username: account.username,
                userId: account.id
              });

              // Redirecionar para dashboard
              return reply.redirect('/dashboard');
            } catch (updateError) {
              logger.error('Erro ao atualizar último login', {
                error: updateError instanceof Error ? updateError.message : 'Erro desconhecido',
                username: account.username
              });

              // Mesmo com erro no update, redirecionar
              return reply.redirect('/dashboard');
            }
          });
        });
      } catch (error) {
        logger.error('Erro crítico na rota de login', {
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          stack: error instanceof Error ? error.stack : 'Sem stack trace',
          url: request.url,
          method: request.method
        });

        return reply.status(500).view('pages/error', {
          title: 'Erro Interno',
          message: 'Ocorreu um erro durante o login. Tente novamente.'
        });
      }
    }
  );

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

        return reply.view('pages/profile', {
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

        (request.session as any).user = updatedSessionUser;

        logger.info(`Perfil atualizado: ${user.username}`);

        return reply.view('pages/profile', {
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
}

function getSessionUser(request: FastifyRequest): User | undefined {
  return request.session && typeof request.session === 'object' 
    ? (request.session as any).user 
    : undefined;
}
