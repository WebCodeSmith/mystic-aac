import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireAuth } from '../middleware/auth-middleware';
import { getSessionUser } from '../types/fastify-custom';
import logger from '../config/logger';
import { ConfigService } from '../services/config.service';
import { renderPage } from '../utils/render-helper';
import downloadRoutes from './download';

// Interface para notícia
interface NewsItem {
  id: number;
  title: string;
  summary: string;
  content: string;
  date: Date;
  author: {
    id: number;
    username: string;
  } | null;
}

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

// Schema para validação dos dados do personagem
const characterCreateSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(20, 'O nome deve ter no máximo 20 caracteres')
    .regex(/^[a-zA-Z ]+$/, 'O nome deve conter apenas letras'),
  vocation: z.enum(['Knight', 'Paladin', 'Sorcerer', 'Druid']),
  sex: z.enum(['male', 'female']),
  world: z.string()
});

// Plugin de rotas de autenticação
export default async function authRoutes(fastify: FastifyInstance) {
  // Inicializar ConfigService
  const configService = new ConfigService();

  // Rota para a página inicial
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Buscar as últimas notícias
      const news = await prisma.news.findMany({
        orderBy: {
          date: 'desc'
        },
        take: 5,
        include: {
          author: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Formatar as notícias para exibição
      const formattedNews = (news as NewsItem[]).map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        date: item.date,
        authorName: item.author?.username || 'Sistema'
      }));

      const user = await getSessionUser(request);
      return reply.view('pages/index', {
        title: 'Início',
        user,
        news: formattedNews,
        onlinePlayers: ONLINE_PLAYERS_COUNT,
        serverName: configService.get('serverName') || 'Mystic AAC'
      });
    } catch (error) {
      logger.error('Erro ao renderizar página inicial:', error);
      return reply.status(500).send('Erro ao carregar página inicial');
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

        // Buscar a lista completa de personagens
        const players = await prisma.player.findMany({
          where: { accountId: user.id },
          select: {
            id: true,
            name: true,
            vocation: true,
            sex: true,
            world: true,
            level: true,
            experience: true,
            health: true,
            healthmax: true,
            mana: true,
            manamax: true
          }
        });

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
          players,
          news,
          serverName: configService.get('serverName') || 'Mystic AAC'
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
  fastify.all('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.session.destroy();
      return reply.redirect('/');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      return reply.status(500).send('Erro ao fazer logout');
    }
  });

  // Registrando as rotas de download
  fastify.register(downloadRoutes);
}
