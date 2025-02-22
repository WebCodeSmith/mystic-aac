import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth-middleware';
import logger from '../config/logger';

const prisma = new PrismaClient();

// Esquema de validação para criação de notícia
const NewsCreateSchema = z.object({
  title: z.string({ 
    required_error: "Título é obrigatório",
    invalid_type_error: "Título deve ser um texto" 
  }).min(3, "Título deve ter pelo menos 3 caracteres"),
  
  summary: z.string({ 
    required_error: "Resumo é obrigatório",
    invalid_type_error: "Resumo deve ser um texto" 
  }).min(10, "Resumo deve ter pelo menos 10 caracteres"),
  
  content: z.string({ 
    required_error: "Conteúdo é obrigatório",
    invalid_type_error: "Conteúdo deve ser um texto" 
  }).min(20, "Conteúdo deve ter pelo menos 20 caracteres"),

  date: z.date().optional()
});

// Definir tipos para parâmetros e body
interface NewsParams {
  id: string;
}

interface NewsBody {
  title: string;
  summary: string;
  content: string;
  date?: Date;
}

// Plugin de rotas de notícias
export default async function newsRoutes(fastify: FastifyInstance) {
  // Rota para listar notícias
  fastify.get('/', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const news = await prisma.news.findMany({
        orderBy: { date: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          summary: true,
          date: true
        }
      });

      return reply.send(news);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ 
        error: 'Erro ao buscar notícias', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para buscar notícia por ID
  fastify.get<{ 
    Params: NewsParams 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: NewsParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const news = await prisma.news.findUnique({
        where: { id: Number(id) },
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          date: true
        }
      });

      if (!news) {
        return reply.status(404).send({ 
          error: 'Notícia não encontrada', 
          message: `Não foi possível encontrar notícia com ID ${id}` 
        });
      }

      return reply.send(news);
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ 
        error: 'Erro ao buscar detalhes da notícia', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para criar notícia
  fastify.post<{ 
    Body: NewsBody 
  }>('/', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Body: NewsBody }>, reply: FastifyReply) => {
    try {
      const { title, summary, content, date } = request.body;

      // Validação dos dados
      const validatedData = NewsCreateSchema.parse({
        title,
        summary,
        content,
        date
      });

      const newNews = await prisma.news.create({
        data: {
          ...validatedData,
          date: validatedData.date || new Date()
        }
      });

      return reply.status(201).send(newNews);
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Erro de validação', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      return reply.status(500).send({ 
        error: 'Erro ao criar notícia', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para atualizar notícia
  fastify.put<{ 
    Params: NewsParams, 
    Body: NewsBody 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: NewsParams, Body: NewsBody }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { title, summary, content, date } = request.body;

    try {
      // Validação dos dados
      const validatedData = NewsCreateSchema.parse({
        title,
        summary,
        content,
        date
      });

      const updatedNews = await prisma.news.update({
        where: { id: Number(id) },
        data: validatedData
      });

      return reply.send(updatedNews);
    } catch (error) {
      request.log.error(error);
      
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ 
          error: 'Erro de validação', 
          message: error.errors.map(e => e.message).join(', ') 
        });
      }

      return reply.status(500).send({ 
        error: 'Erro ao atualizar notícia', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para deletar notícia
  fastify.delete<{ 
    Params: NewsParams 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: NewsParams }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      await prisma.news.delete({
        where: { id: Number(id) }
      });

      return reply.status(204).send();
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ 
        error: 'Erro ao deletar notícia', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });
}
