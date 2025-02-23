import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  requireAuth, 
  logUserActivity
} from '../middleware/auth-middleware';
import { renderPage } from '../utils/render-helper';
import prisma from '../services/prisma';
import logger from '../config/logger';
import { getSessionUser } from '../types/fastify-custom';
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

// Plugin de rotas de autenticação
export default async function authRoutes(fastify: FastifyInstance) {
  // Inicializar ConfigService
  const configService = new ConfigService();

  // Rota de index
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const news = await prisma.news.findMany({
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          summary: true,
          date: true,
          author: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      return reply.view('pages/index', { 
        title: 'Bem-vindo',
        serverName: configService.getServerName(), 
        onlinePlayers: ONLINE_PLAYERS_COUNT,
        news: news.map(newsItem => {
          console.log(newsItem);
          return {
            ...newsItem,
            authorName: newsItem.author ? newsItem.author.username : 'Autor desconhecido'
          }
        }) // Passar as notícias para a view
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
      preHandler: [requireAuth] 
    }, 
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Garantir que o usuário existe na sessão
        if (!request.session?.user?.id) {
          return reply.redirect('/login');
        }

        const user = request.session.user;

        // Buscar o jogador
        const player = await prisma.player.findFirst({
          where: { accountId: user.id }
        });

        // Buscar as notícias
        const news = await prisma.news.findMany({
          orderBy: { date: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            summary: true,
            date: true,
            author: {
              select: {
                id: true,
                username: true
              }
            }
          }
        });

        return reply.view('pages/dashboard', {
          title: 'Painel do Jogador',
          user,
          player,
          news
        });
      } catch (error) {
        // Verificar se o erro é uma instância de Error
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('Erro ao acessar o dashboard', {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : 'Sem stack trace'
        });
        
        // Renderizar a página de erro
        return reply.view('pages/error', { 
          title: 'Erro', 
          message: errorMessage || 'Ocorreu um erro inesperado.' 
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
