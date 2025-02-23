import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/auth-middleware';
import logger from '../config/logger';
import { getSessionUser } from '../types/fastify-custom';

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

export default async function characterRoutes(fastify: FastifyInstance) {
  // Rota para exibir o formulário de criação
  fastify.get('/create', {
    preHandler: [requireAuth]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getSessionUser(request);
      if (!user) {
        return reply.redirect('/login');
      }

      return reply.view('pages/character-create', {
        title: 'Criar Personagem',
        user
      });
    } catch (error) {
      logger.error('Erro ao renderizar página de criação de personagem', {
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return reply.status(500).send({ error: 'Erro interno ao renderizar página' });
    }
  });

  // Rota para processar a criação do personagem
  fastify.post('/create', {
    preHandler: [requireAuth]
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = getSessionUser(request);
      if (!user) {
        return reply.redirect('/login');
      }

      const result = characterCreateSchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          issues: result.error.issues
        });
      }

      // Verificar se já existe um personagem com este nome
      const existingCharacter = await prisma.player.findFirst({
        where: { name: result.data.name }
      });

      if (existingCharacter) {
        return reply.status(400).send({
          error: 'Nome já está em uso'
        });
      }

      // Criar o personagem
      const character = await prisma.player.create({
        data: {
          name: result.data.name,
          vocation: result.data.vocation,
          sex: result.data.sex,
          level: 1,
          experience: 0,
          health: 150,
          healthmax: 150,
          mana: 0,
          manamax: 0,
          accountId: user.id,
          looktype: result.data.sex === 'male' ? 128 : 136,
          town_id: 1,
          world: parseInt(result.data.world),
          updatedAt: new Date()
        }
      });

      return reply.redirect('/dashboard');
    } catch (error) {
      logger.error('Erro ao criar personagem', {
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return reply.status(500).send({ error: 'Erro interno ao criar personagem' });
    }
  });
}
