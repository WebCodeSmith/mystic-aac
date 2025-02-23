import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth-middleware';
import logger from '../config/logger';
import { getSessionUser } from '../types/fastify-custom';
import { defaultCharacterData, Vocation, vocationMap } from '../config/config'; // Ajustando o caminho para o arquivo de configuração

const prisma = new PrismaClient();

// Atualizar a função de validação
const validateVocation = (vocation: number): boolean => {
  return vocation >= 0 && vocation <= 4;  // Validar range de vocações
};

// Atualizar o schema de validação
const characterCreateSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(20, 'O nome deve ter no máximo 20 caracteres')
    .regex(/^[a-zA-Z ]+$/, 'O nome deve conter apenas letras'),
  vocation: z.enum(['0', '1', '2', '3', '4']),  // Incluir '0' para Rookie
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

      logger.warn('Valor da vocação antes da validação:', result.data.vocation);

      const vocationNumber = parseInt(result.data.vocation);
      if (!validateVocation(vocationNumber)) {
        return reply.status(400).send({ error: 'Vocação inválida' });
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

      // Modificar a criação do personagem
      const character = await prisma.player.create({
        data: {
          ...defaultCharacterData,    // Primeiro as configurações padrão
          name: result.data.name,
          sex: result.data.sex,
          accountId: user.id,
          looktype: result.data.sex === 'male' ? 128 : 136,
          vocation: vocationNumber    // Sobrescreve a vocação padrão com a selecionada
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
