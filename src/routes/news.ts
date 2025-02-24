import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth-middleware';
import { getSessionUser } from '../types/fastify-custom';
import { z } from 'zod';

// Constants
const NEWS_PER_PAGE = 10;

// Types
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

// Schemas
const newsSchema = z.object({
  title: z.string()
    .min(3, 'The title must have at least 3 characters')
    .max(100, 'Title must have a maximum of 100 characters'),
  summary: z.string()
    .min(10, 'Summary must be at least 10 characters long')
    .max(255, 'Summary must have a maximum of 255 characters'),
  content: z.string()
    .min(10, 'Content must be at least 10 characters long'),
  date: z.string().datetime().optional()
});

// Helper Functions
const sendError = (reply: FastifyReply, status: number, error: string, message: string) => {
  return reply.status(status).send({ error, message });
};

const validateAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  const user = await getSessionUser(request);
  if (!user?.role || user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Acesso não autorizado' });
  }
  return user;
};

// Routes Plugin
export default async function newsRoutes(fastify: FastifyInstance) {
  // List News
  fastify.get('/', { 
    preHandler: [requireAuth] 
  }, async (request, reply) => {
    try {
      const news = await prisma.news.findMany({
        orderBy: { date: 'desc' },
        take: NEWS_PER_PAGE,
        select: {
          id: true,
          title: true,
          summary: true,
          date: true
        }
      });

      return reply.send(news);
    } catch (error) {
      return sendError(reply, 500, 'Erro ao buscar notícias', 
        error instanceof Error ? error.message : 'Erro desconhecido');
    }
  });

  // Add Create News Form Route
  fastify.get('/create', {
    preHandler: [requireAuth, requireAdmin]
  }, async (request, reply) => {
    try {
      const user = await getSessionUser(request);
      return reply.view('pages/news-create', {
        title: 'Criar Notícia',
        user,
        error: null,
        success: null
      });
    } catch (error) {
      return sendError(reply, 500, 'Erro ao carregar formulário', 
        'Não foi possível carregar o formulário de criação');
    }
  });

  // Create News
  fastify.post<{ Body: z.infer<typeof newsSchema> }>('/create', { 
    preHandler: [requireAuth, requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['title', 'summary', 'content'],
        properties: {
          title: { 
            type: 'string', 
            minLength: 3, 
            maxLength: 100 
          },
          summary: { 
            type: 'string', 
            minLength: 10, 
            maxLength: 255 
          },
          content: { 
            type: 'string', 
            minLength: 10 
          },
          date: { 
            type: 'string', 
            format: 'date-time' 
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = await getSessionUser(request);
      
      if (!user?.id) {
        return sendError(reply, 401, 'Não autorizado', 
          'Usuário não autenticado');
      }

      const { title, summary, content, date } = request.body;
      
      await prisma.news.create({
        data: {
          title,
          summary,
          content,
          date: date ? new Date(date) : new Date(),
          updatedAt: new Date(),
          authorId: user.id
        }
      });

      // Redirecionando para a lista de notícias ao invés do dashboard
      return reply.redirect('/news');
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, 400, 'Erro de validação', 
          error.errors.map(e => e.message).join(', '));
      }
      return sendError(reply, 500, 'Erro ao criar notícia', 
        error instanceof Error ? error.message : 'Erro desconhecido');
    }
  });

  // Get News by ID
  fastify.get<{ Params: { id: string } }>('/:id', { 
    preHandler: [requireAuth] 
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const newsId = parseInt(id, 10); // Converter string para número

      if (isNaN(newsId)) {
        return sendError(reply, 400, 'ID inválido', 
          'O ID da notícia deve ser um número válido');
      }

      const news = await prisma.news.findUnique({
        where: { 
          id: newsId // Usar o ID convertido
        },
        select: {
          id: true,
          title: true,
          summary: true,
          content: true,
          date: true,
          author: {
            select: {
              username: true
            }
          }
        }
      });

      if (!news) {
        return sendError(reply, 404, 'Notícia não encontrada', 
          `Não foi possível encontrar notícia com ID ${id}`);
      }

      return reply.send(news);
    } catch (error) {
      return sendError(reply, 500, 'Erro ao buscar detalhes da notícia', 
        error instanceof Error ? error.message : 'Erro desconhecido');
    }
  });

  // Update News
  fastify.put<{ 
    Params: { id: string }, 
    Body: z.infer<typeof newsSchema>
  }>('/:id', { 
    preHandler: [requireAuth, requireAdmin] 
  }, async (request, reply) => {
    const { id } = request.params;
    const { title, summary, content, date } = request.body;

    try {
      const updatedNews = await prisma.news.update({
        where: { id: Number(id) },
        data: {
          title,
          summary,
          content,
          date: date ? new Date(date) : undefined,
          updatedAt: new Date()
        }
      });

      return reply.send(updatedNews);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(reply, 400, 'Erro de validação', 
          error.errors.map(e => e.message).join(', '));
      }
      return sendError(reply, 500, 'Erro ao atualizar notícia', 
        error instanceof Error ? error.message : 'Erro desconhecido');
    }
  });

  // Delete News
  fastify.delete<{ Params: { id: string } }>('/:id', { 
    preHandler: [requireAuth, requireAdmin] 
  }, async (request, reply) => {
    const { id } = request.params;
    const user = await getSessionUser(request);

    try {
      // Verify user is admin and exists
      if (!user?.id || user.role !== 'ADMIN') {
        return sendError(reply, 403, 'Acesso não autorizado', 
          'Você não tem permissão para deletar notícias');
      }

      // Check if news exists and belongs to user
      const existingNews = await prisma.news.findUnique({
        where: { id: Number(id) },
        select: { id: true, authorId: true }
      });

      if (!existingNews) {
        return sendError(reply, 404, 'Notícia não encontrada', 
          'A notícia que você tentou deletar não existe');
      }

      // Delete the news
      await prisma.news.delete({
        where: { id: Number(id) }
      });

      return reply.status(204).send();
    } catch (error) {
      return sendError(reply, 500, 'Erro ao deletar notícia', 
        error instanceof Error ? error.message : 'Erro desconhecido');
    }
  });
}
