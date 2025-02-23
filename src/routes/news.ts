import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth-middleware';
import logger from '../config/logger';

declare module 'fastify' {
  interface FastifyRequest {
    user?: any;
  }
}

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

  date: z.string().datetime().optional()
});

// Definir tipos para parâmetros e body
interface NewsParams {
  id: string;
}

type NewsBody = z.infer<typeof NewsCreateSchema>;

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
  }>('/create', { 
    preHandler: [requireAuth],
    schema: {
      body: {
        type: 'object',
        required: ['title', 'summary', 'content'],
        properties: {
          title: { type: 'string', minLength: 3 },
          summary: { type: 'string', minLength: 10 },
          content: { type: 'string', minLength: 20 },
          date: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const result = NewsCreateSchema.safeParse(request.body);
      
      if (!result.success) {
        return reply.status(400).send({
          error: 'Erro de validação',
          message: result.error.errors.map(e => e.message).join(', ')
        });
      }

      const { title, summary, content, date } = result.data;
      
      const news = await prisma.news.create({
        data: {
          title,
          summary,
          content,
          date: date ? new Date(date) : new Date()
        }
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

  // Rota para renderizar página de criação de notícias
  fastify.get('/create', { 
    preHandler: [requireAuth] 
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.view('pages/news-create', { 
        title: 'Criar Notícia',
        user: request.user,
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
