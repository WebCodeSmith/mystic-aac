import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth-middleware';
import logger from '../config/logger';
import { ConfigService, formatDateTime } from '../services/config.service';
import { getVocationName } from '../config/config';

// Types
interface NewsAuthor {
  id: number;
  username: string;
}

interface FormattedNews {
  id: number;
  title: string;
  summary: string;
  content: string;
  date: Date;
  authorName: string;
}

interface PlayerData {
  name: string;
  level: number;
  vocation: number; // Mudado de string para number
  experience: bigint; // Mudado de number para bigint
}

// Constants
const NEWS_LIMIT = 5;
const TOP_PLAYERS_LIMIT = 3;
const RANKING_LIMIT = 50;

// Validation Schemas
const characterCreateSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(20, 'O nome deve ter no máximo 20 caracteres')
    .regex(/^[a-zA-Z ]+$/, 'O nome deve conter apenas letras'),
  vocation: z.enum(['Knight', 'Paladin', 'Sorcerer', 'Druid']),
  sex: z.enum(['male', 'female']),
  world: z.string()
});

// Helper Functions
async function getLatestNews() {
  return prisma.news.findMany({
    orderBy: { date: 'desc' },
    take: NEWS_LIMIT,
    include: {
      author: {
        select: {
          id: true,
          username: true
        }
      }
    }
  });
}

async function getTopPlayers(limit: number) {
  return prisma.player.findMany({
    orderBy: [
      { level: 'desc' },
      { experience: 'desc' }
    ],
    take: limit,
    select: {
      name: true,
      level: true,
      vocation: true,
      experience: true
    }
  });
}

// Update the formatPlayers function
function formatPlayers(players: PlayerData[]) {
  return players.map(player => ({
    ...player,
    experience: Number(player.experience),
    vocation: getVocationName(player.vocation)
  }));
}

// Routes Plugin
export default async function authRoutes(fastify: FastifyInstance) {
  const configService = new ConfigService();
  const serverName = configService.get('serverName') || 'Mystic AAC';

  // Home Route
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [news, topPlayers] = await Promise.all([
        getLatestNews(),
        getTopPlayers(TOP_PLAYERS_LIMIT)
      ]);

      const formattedNews = news.map(item => ({
        ...item,
        authorName: item.author?.username || 'Sistema'
      }));

      return reply.view('pages/index', {
        title: 'Início',
        user: request.session?.user || null,
        news: formattedNews,
        topPlayers: formatPlayers(topPlayers),
        serverName
      });
    } catch (error) {
      logger.error('Erro ao renderizar página inicial:', error);
      return reply.status(500).view('pages/error', {
        title: 'Erro',
        message: 'Erro ao carregar página inicial'
      });
    }
  });

  // Dashboard Route
  fastify.get('/dashboard', 
    { preHandler: [requireAuth] }, 
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = request.session?.user;
        if (!user?.id) return reply.redirect('/login');
  
        // Buscar o primeiro personagem do usuário para usar como avatar
        const [players, news, mainPlayer] = await Promise.all([
          prisma.player.findMany({
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
          }),
          getLatestNews(),
          prisma.player.findFirst({
            where: { accountId: user.id },
            select: {
              id: true,
              name: true,
              level: true,
              vocation: true,
              experience: true // Adicionando o campo experience
            }
          })
        ]);
  
        return reply.view('pages/dashboard', {
          title: 'Painel do Jogador',
          user,
          players,
          news,
          player: mainPlayer, // Adicionando o player principal
          formatDateTime,
          getVocationName,
          serverName
        });
      } catch (error) {
        logger.error('Erro ao acessar o dashboard:', error);
        return reply.status(500).view('pages/error', {
          title: 'Erro',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
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
      const topPlayers = await getTopPlayers(RANKING_LIMIT);

      // Formats player data with vocation names
      const formattedPlayers = formatPlayers(topPlayers);

      return reply.view('pages/ranking', {
        title: 'Ranking - Top Players',
        topPlayers: formattedPlayers,
        serverName,
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
        serverName
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
