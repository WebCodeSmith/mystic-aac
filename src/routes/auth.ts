import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  requireAuth, 
  preventAuthenticatedAccess, 
  logUserActivity 
} from '../middleware/auth-middleware';
import { 
  AuthService 
} from '../services/auth-service';
import { renderPage } from '../utils/render-helper';
import { AppError } from '../middleware/error-handler';
import prisma from '../services/prisma';
import logger from '../config/logger';
import { User } from '../types/express-session';
import path from 'path';
import { ConfigService } from '../services/config.service';

// Constantes
const ONLINE_PLAYERS_COUNT = 42; // Substituir por valor real/dinâmico

// Renderização consistente
const renderPageWithOnlinePlayers = async (
  reply: FastifyReply, 
  page: string, 
  options: { 
    title: string, 
    error?: string, 
    success?: string,
    [key: string]: any  // Permitir propriedades adicionais
  }
) => {
  // Verificações de segurança
  if (!reply || !page) {
    logger.error('Parâmetros inválidos para renderização', { 
      reply: !!reply, 
      page 
    });
    return reply.status(500).send('Erro interno: Parâmetros de renderização inválidos');
  }

  // Verificar se a resposta já foi enviada
  if (reply.sent) {
    logger.warn('Tentativa de renderizar página já enviada', { page });
    return reply;
  }

  try {
    // Renderizar página com contagem de jogadores online
    return renderPage(reply, page, { 
      ...options, 
      onlinePlayers: ONLINE_PLAYERS_COUNT 
    });
  } catch (error) {
    // Log de erro detalhado
    logger.error('Erro ao renderizar página com jogadores online', {
      page,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : 'Sem stack trace'
    });

    // Garantir que apenas uma resposta seja enviada
    if (!reply.sent) {
      return reply.status(500).send('Erro interno ao renderizar página');
    }

    return reply;
  }
};

// Função auxiliar para obter usuário da sessão
const getSessionUser = (request: FastifyRequest): User | undefined => 
  request.session && typeof request.session === 'object' 
    ? (request.session as any).user 
    : undefined;

// Plugin de rotas de autenticação
export default async function authRoutes(fastify: FastifyInstance) {
  // Inicializar ConfigService
  const configService = new ConfigService();

  // Rota de index
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.view('pages/index', { 
        title: 'Bem-vindo',
        serverName: configService.getServerName(), 
        onlinePlayers: ONLINE_PLAYERS_COUNT
      });
    } catch (error) {
      logger.error('Erro ao renderizar página inicial', {
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : 'Sem stack trace'
      });
      return reply.status(500).send('Erro interno ao renderizar página inicial');
    }
  });

  // Rota de registro
  fastify.post('/register', 
    { 
      schema: {
        body: {
          type: 'object',
          properties: {
            username: { 
              type: 'string', 
              minLength: 3, 
              maxLength: 50,
              pattern: '^[a-zA-Z0-9_]+$'
            },
            email: { type: 'string', format: 'email' },
            password: { 
              type: 'string', 
              minLength: 8, 
              maxLength: 100,
              pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
            },
            confirmPassword: { type: 'string' }
          },
          required: ['username', 'email', 'password', 'confirmPassword']
        }
      },
      preHandler: [
        preventAuthenticatedAccess
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const accountData = request.body as { 
          username: string; 
          email: string; 
          password: string; 
          confirmPassword: string 
        };
        
        await AuthService.createAccount(accountData);

        return renderPageWithOnlinePlayers(reply, 'register', { 
          title: 'Registro', 
          success: 'Conta criada com sucesso! Faça login.' 
        });
      } catch (error) {
        logger.error('Erro no registro:', error);
        return renderPageWithOnlinePlayers(reply, 'register', { 
          title: 'Registro', 
          error: error instanceof Error ? error.message : 'Erro interno no servidor'
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
            email: { type: 'string', format: 'email' },
            username: { type: 'string', minLength: 3 }
          },
          required: ['email', 'username']
        }
      },
      preHandler: [
        preventAuthenticatedAccess
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { email, username } = request.body as { email: string, username: string };
        const result = await AuthService.recoverPassword(email, username);

        return renderPageWithOnlinePlayers(reply, 'recover-password', { 
          title: 'Recuperar Senha', 
          success: 'Instruções de recuperação enviadas para seu e-mail.' 
        });
      } catch (error) {
        logger.error('Erro na recuperação de senha:', error);
        return renderPageWithOnlinePlayers(reply, 'recover-password', { 
          title: 'Recuperar Senha', 
          error: error instanceof Error ? error.message : 'Erro interno no servidor'
        });
      }
    }
  );

  // Rota de dashboard
  fastify.get('/dashboard', 
    { 
      preHandler: [
        requireAuth, 
        logUserActivity
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getSessionUser(request);
        const player = await prisma.player.findUnique({
          where: {
            accountId: user?.id
          },
          select: {
            id: true,
            name: true,
            level: true,
            experience: true
          }
        });

        return renderPageWithOnlinePlayers(reply, 'dashboard', {
          title: 'Dashboard',
          user: user,
          player: player
        });
      } catch (error) {
        logger.error('Erro ao buscar informações do jogador:', error);
        return renderPageWithOnlinePlayers(reply, 'error', {
          title: 'Erro',
          error: 'Não foi possível carregar as informações do jogador'
        });
      }
    }
  );

  // Rota de logout usando route
  fastify.route({
    method: 'GET',
    url: '/logout',
    preHandler: [requireAuth],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Destruir sessão
        await request.session.destroy();

        logger.info('Usuário deslogado');
        return reply.redirect('/account/login');
      } catch (error) {
        logger.error('Erro no logout:', error);
        return renderPageWithOnlinePlayers(reply, 'error', {
          title: 'Erro de Logout',
          error: 'Erro interno durante o logout'
        });
      }
    }
  });
}
