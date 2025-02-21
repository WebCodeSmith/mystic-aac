import express, { Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth-middleware';
import { AppError, asyncHandler } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../types/express-custom';
import logger from '../config/logger';

const router = express.Router();
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

// Serviços de notícias com tratamento de erros centralizado
const newsService = {
  async findById(id: number) {
    const news = await prisma.news.findUnique({ where: { id } });
    if (!news) {
      throw new AppError('Notícia não encontrada', 404);
    }
    return news;
  },

  async create(data: Prisma.NewsCreateInput) {
    try {
      // Log dos dados recebidos para depuração
      logger.info('Dados recebidos para criação de notícia:', data);

      // Validação dos dados antes da criação
      const validatedData = NewsCreateSchema.parse({
        title: data.title,
        summary: data.summary,
        content: data.content,
        date: data.date || new Date()
      });
      
      return await prisma.news.create({ 
        data: {
          title: validatedData.title,
          summary: validatedData.summary,
          content: validatedData.content,
          date: validatedData.date || new Date()
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Tratamento específico para erros de validação do Zod
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        
        logger.error('Erro de validação ao criar notícia:', {
          errors: error.errors,
          input: data
        });
        
        throw new AppError(`Dados inválidos: ${errorMessages}`, 400);
      }
      
      logger.error('Erro ao criar notícia:', error);
      throw new AppError('Não foi possível criar a notícia', 500);
    }
  },

  async update(id: number, data: Prisma.NewsUpdateInput) {
    try {
      await this.findById(id); // Verifica se a notícia existe
      return await prisma.news.update({
        where: { id },
        data
      });
    } catch (error) {
      logger.error('Erro ao atualizar notícia:', error);
      throw new AppError('Não foi possível atualizar a notícia', 500);
    }
  },

  async delete(id: number) {
    try {
      await this.findById(id); // Verifica se a notícia existe
      return await prisma.news.delete({ where: { id } });
    } catch (error) {
      logger.error('Erro ao excluir notícia:', error);
      throw new AppError('Não foi possível excluir a notícia', 500);
    }
  }
};

// Função utilitária para renderizar resposta de erro
function handleNewsError(res: Response, error: any, defaultMessage: string) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : defaultMessage;

  return res.status(statusCode).json({ 
    success: false, 
    message,
    error: error instanceof Error ? error.message : 'Erro desconhecido'
  });
}

// Rotas de visualização
router.get('/', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const news = await prisma.news.findMany({
    orderBy: { date: 'desc' },
    take: 10
  });

  res.render('pages/news-create', {
    title: 'Notícias',
    news,
    newsItem: null,
    isEditing: false,
    user: req.session.user
  });
}));

// Rotas de criação, edição e visualização
router.get('/create', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.render('pages/news-create', {
    title: 'Criar Notícia',
    newsItem: null,
    isEditing: false,
    news: [],
    user: req.session.user
  });
});

router.get('/:id/edit', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const newsItem = await newsService.findById(Number(id));

  res.render('pages/news-create', {
    title: 'Editar Notícia',
    newsItem,
    isEditing: true,
    user: req.session.user
  });
}));

// Rotas de criação e atualização
router.post('/create', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { title, summary, content } = req.body;

  try {
    // Log dos dados recebidos para depuração
    logger.info('Dados recebidos no POST /create:', { title, summary, content });

    const createdNews = await newsService.create({ 
      title, 
      summary, 
      content,
      date: new Date()
    });

    // Busca as notícias para passar para o template
    const news = await prisma.news.findMany({
      orderBy: { date: 'desc' },
      take: 10
    });

    res.render('pages/news-create', {
      title: 'Notícias',
      news,
      newsItem: null,
      isEditing: false,
      user: req.session.user,
      successMessage: 'Notícia criada com sucesso!'
    });
  } catch (error) {
    // Log do erro para depuração
    logger.error('Erro ao criar notícia:', error);
    
    // Busca as notícias para passar para o template
    const news = await prisma.news.findMany({
      orderBy: { date: 'desc' },
      take: 10
    });

    res.render('pages/news-create', {
      title: 'Criar Notícia',
      news,
      newsItem: null,
      isEditing: false,
      user: req.session.user,
      error: error instanceof Error ? error.message : 'Erro ao criar notícia'
    });
  }
}));

router.put('/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { title, summary, content } = req.body;

  await newsService.update(Number(id), { 
    title, 
    summary, 
    content 
  });
  res.redirect('/news');
}));

// Rotas de exclusão (DELETE e POST para compatibilidade)
router.delete('/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  await newsService.delete(Number(id));
  res.status(200).json({ 
    success: true, 
    message: 'Notícia excluída com sucesso' 
  });
}));

router.post('/delete/:id', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    await newsService.delete(Number(id));
    res.status(200).json({ 
      success: true, 
      message: 'Notícia excluída com sucesso' 
    });
  } catch (error) {
    handleNewsError(res, error, 'Erro ao excluir notícia');
  }
}));

export default router;
