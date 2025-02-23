import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/auth-middleware';
import { getSessionUser } from '../types/fastify-custom';
import logger from '../config/logger';
import { z } from 'zod';

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

const newsSchema = z.object({
  title: z.string().min(3).max(100),
  summary: z.string().min(10).max(255),
  content: z.string().min(10),
  date: z.string().datetime().optional()
});

type NewsInput = z.infer<typeof newsSchema>;

export default async function newsRoutes(fastify: FastifyInstance) {
  // Rota para listar notícias
  fastify.get('/', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await getSessionUser(request);
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
    Params: { id: string } 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const user = await getSessionUser(request);
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
  fastify.get('/create', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await getSessionUser(request);
      if (!user?.role || user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Acesso não autorizado' });
      }

      return reply.view('pages/news-create', { 
        title: 'Criar Notícia',
        user: user,
        isEditing: false,
        newsItem: null
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ 
        error: 'Erro ao carregar página de criação de notícia', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  fastify.post<{
    Body: NewsInput
  }>('/create', { 
    preHandler: [requireAuth],
    schema: {
      body: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title: { type: 'string', minLength: 1 },
          content: { type: 'string', minLength: 1 },
          summary: { type: 'string' },
          date: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await getSessionUser(request);
      if (!user?.role || user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Acesso não autorizado' });
      }

      const result = newsSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          error: 'Erro de validação',
          message: result.error.errors.map(e => e.message).join(', ')
        });
      }

      const { title, summary, content, date } = result.data;
      
      const newsData = {
        title,
        summary,
        content,
        date: date ? new Date(date) : new Date(),
        updatedAt: new Date(),
        authorId: user.id
      };

      const news = await prisma.news.create({
        data: newsData
      });

      return reply.redirect('/dashboard');
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ 
        error: 'Erro ao criar notícia', 
        message: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Rota para atualizar notícia
  fastify.put<{ 
    Params: { id: string }, 
    Body: NewsInput
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: { id: string }, Body: NewsInput }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { title, summary, content, date } = request.body;

    try {
      const user = await getSessionUser(request);
      // Validação dos dados
      const validatedData = newsSchema.parse({
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
    Params: { id: string } 
  }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const user = await getSessionUser(request);
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
