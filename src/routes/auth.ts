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
import { User } from '../types/fastify-session';
import path from 'path';
import { ConfigService } from '../services/config.service';
import { RateLimiter } from '../utils/rate-limiter'; // Importação correta

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

  // Rota de dashboard
  fastify.get('/dashboard', 
    { 
      preHandler: [
        requireAuth, 
        logUserActivity
      ]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      console.log('Acessando a rota do dashboard'); // Log adicionado
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

        return renderPage(reply, 'dashboard', {
          title: 'Dashboard',
          user: user,
          player: player
        });
      } catch (error) {
        logger.error('Erro ao buscar informações do jogador:', error);
        return renderPage(reply, 'error', {
          title: 'Erro',

        });
      }
    }
  );

  // Rota de logout
  fastify.get('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.session.destroy();
      return reply.redirect('/account/login');
    } catch (error) {
      logger.error('Erro ao fazer logout:', error);
      return reply.status(500).send('Erro ao fazer logout');
    }
  });
}
