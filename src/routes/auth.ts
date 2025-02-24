import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { requireAuth } from '../middleware/auth-middleware';
import { getSessionUser } from '../types/fastify-custom';
import logger from '../config/logger';
import { ConfigService } from '../services/config.service';
import { renderPage } from '../utils/render-helper';
import { Vocation, getVocationName } from '../config/config';

// News interface
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
const ONLINE_PLAYERS_COUNT = 42; // Replace with real/dynamic value

// Renderização consistente
const renderPageWithOnlinePlayers = async (
  reply: FastifyReply, 
  page: string, 
  options: { 
    title: string, 
    error?: string, 
    success?: string,
    [key: string]: any  // Allow additional properties
  }
) => {
  // Security checks
  if (!reply || !page) {
    logger.error('Parâmetros inválidos para renderização', { 
      reply: !!reply, 
      page 
    });
    return reply.status(500).send('Erro interno: Parâmetros de renderização inválidos');
  }

  // Check if the response has already been sent
  if (reply.sent) {
    logger.warn('Tentativa de renderizar página já enviada', { page });
    return reply;
  }

  try {
    // Render page with online player count
    return renderPage(reply, page, { 
      ...options, 
      onlinePlayers: ONLINE_PLAYERS_COUNT 
    });
  } catch (error) {
    // Detailed error log
    logger.error('Erro ao renderizar página com jogadores online', {
      page,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : 'Sem stack trace'
    });

    // Ensure only one response is sent
    if (!reply.sent) {
      return reply.status(500).send('Erro interno ao renderizar página');
    }

    return reply;
  }
};

// Schema for validating character data
const characterCreateSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(20, 'O nome deve ter no máximo 20 caracteres')
    .regex(/^[a-zA-Z ]+$/, 'O nome deve conter apenas letras'),
  vocation: z.enum(['Knight', 'Paladin', 'Sorcerer', 'Druid']),
  sex: z.enum(['male', 'female']),
  world: z.string()
});

// Authentication Routes Plugin
export default async function authRoutes(fastify: FastifyInstance) {
  // Initialize ConfigService
  const configService = new ConfigService();

  // Route to home page
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Search for the latest news
      const news = await prisma.news.findMany({
        orderBy: { date: 'desc' },
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

      // Search top players
      const topPlayers = await prisma.player.findMany({
        orderBy: [
          { level: 'desc' },
          { experience: 'desc' }
        ],
        take: 3, // limit to 3 players
        select: {
          name: true,
          level: true,
          vocation: true,
          experience: true
        }
      });

      // Format news and players
      const formattedNews = news.map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        content: item.content,
        date: item.date,
        authorName: item.author?.username || 'Sistema'
      }));

      const formattedPlayers = topPlayers.map(player => ({
        ...player,
        vocation: getVocationName(player.vocation)
      }));

      const user = await getSessionUser(request);
      return reply.view('pages/index', {
        title: 'Início',
        user,
        news: formattedNews,
        topPlayers: formattedPlayers,
        onlinePlayers: ONLINE_PLAYERS_COUNT,
        serverName: configService.get('serverName') || 'Mystic AAC'
      });
    } catch (error) {
      logger.error('Erro ao renderizar página inicial:', error);
      return reply.status(500).send('Erro ao carregar página inicial');
    }
  });

  // Route Dashboard
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

        // Search for player
        const player = await prisma.player.findFirst({
          where: { accountId: user.id }
        });

        // Search for news
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
          getVocationName,
          serverName: configService.get('serverName') || 'Mystic AAC'
        });
      } catch (error) {
        // Check if error is an instance of Error
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('Erro ao acessar o dashboard', {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : 'Sem stack trace'
        });
        
        // Render the error page
        return reply.view('pages/error', { 
          title: 'Erro', 
          message: errorMessage || 'Ocorreu um erro inesperado.' 
        });
      }
    }
  );

  // Route Logout
  fastify.all('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.session.destroy();
      return reply.redirect('/');
    } catch (error) {
      logger.error('Erro ao fazer logout', error);
      return reply.status(500).send('Erro ao fazer logout');
    }
  });

  // Ranking route
  fastify.get('/highscores', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const topPlayers = await prisma.player.findMany({
        orderBy: [
          { level: 'desc' },    // Primeiro ordena por level
          { experience: 'desc' } // Depois por experiência
        ],
        take: 50, // Limita aos top 50 jogadores
        select: {
          name: true,
          level: true,
          vocation: true,
          experience: true
        }
      });

      // Formats player data with vocation names
      const formattedPlayers = topPlayers.map(player => ({
        ...player,
        vocation: getVocationName(player.vocation)
      }));

      return reply.view('pages/ranking', {
        title: 'Ranking - Top Players',
        topPlayers: formattedPlayers,
        serverName: configService.get('serverName') || 'Mystic AAC',
        user: request.session?.user
      });

    } catch (error) {
      logger.error('Erro ao carregar ranking:', error);
      return reply.status(500).view('pages/error', {
        title: 'Erro',
        message: 'Falha ao carregar ranking'
      });
    }
  });

  // Download Route
  fastify.get('/download', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.view('pages/download', {
        title: 'Download',
        user: request.session?.user || null,
        serverName: configService.get('serverName') || 'Mystic AAC'
      });
    } catch (error) {
      logger.error('Erro ao acessar página de download:', error);
      return reply.status(500).view('pages/error', {
        title: 'Erro',
        message: 'Erro ao carregar página de download'
      });
    }
  });

}
