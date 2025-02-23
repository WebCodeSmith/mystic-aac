import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/auth-middleware';

// Definir tipos para os parâmetros e query
interface PlayerQueryParams {
  page?: number;
  limit?: number;
  vocation?: string;
  minLevel?: number;
}

interface PlayerParams {
  id: string;
}

// Plugin de rotas de jogadores
export default async function playerRoutes(fastify: FastifyInstance) {
  // Rota para buscar jogadores com paginação e filtros
  fastify.get<{ 
    Querystring: PlayerQueryParams 
  }>('/', async (request: FastifyRequest<{ Querystring: PlayerQueryParams }>, reply: FastifyReply) => {
    const { 
      page = 1, 
      limit = 10, 
      vocation, 
      minLevel 
    } = request.query;

    const skip = (page - 1) * limit;

    const whereCondition = {
      ...(vocation && { vocation: Number(vocation) }),
      ...(minLevel && { level: { gte: minLevel } })
    };

    try {
      const [total, players] = await Promise.all([
        prisma.player.count({ where: whereCondition }),
        prisma.player.findMany({
          where: whereCondition,
          take: limit,
          skip: skip,
          orderBy: { level: 'desc' },
          select: {
            id: true,
            name: true,
            level: true,
            vocation: true,
            avatar: true
          }
        })
      ]);

      reply.send({
        total,
        page,
        limit,
        players
      });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ 
        error: 'Erro ao buscar jogadores', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para buscar detalhes de um jogador específico
  fastify.get<{ 
    Params: PlayerParams 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: PlayerParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const player = await prisma.player.findUnique({
        where: { id: Number(id) },
        select: {
          id: true,
          name: true,
          level: true,
          vocation: true,
          avatar: true,
          experience: true,
          account: {
            select: {
              username: true,
              email: true
            }
          }
        }
      });

      if (!player) {
        return reply.status(404).send({ 
          error: 'Jogador não encontrado', 
          message: `Não foi possível encontrar jogador com ID ${id}` 
        });
      }

      reply.send(player);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ 
        error: 'Erro ao buscar detalhes do jogador', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para atualizar perfil do jogador
  fastify.put<{ 
    Params: PlayerParams 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: PlayerParams }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { name, avatar, vocation } = request.body as { 
      name?: string, 
      avatar?: string, 
      vocation?: string 
    };

    try {
      const updatedPlayer = await prisma.player.update({
        where: { id: Number(id) },
        data: {
          ...(name && { name }),
          ...(avatar && { avatar }),
          ...(vocation && { vocation: Number(vocation) })
        },
        select: {
          id: true,
          name: true,
          level: true,
          vocation: true,
          avatar: true
        }
      });

      reply.send(updatedPlayer);
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ 
        error: 'Erro ao atualizar perfil do jogador', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });
}
