"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = newsRoutes;
const prisma_1 = __importDefault(require("../services/prisma"));
const auth_middleware_1 = require("../middleware/auth-middleware");
const fastify_custom_1 = require("../types/fastify-custom");
const zod_1 = require("zod");
const newsSchema = zod_1.z.object({
    title: zod_1.z.string().min(3).max(100),
    summary: zod_1.z.string().min(10).max(255),
    content: zod_1.z.string().min(10),
    date: zod_1.z.string().datetime().optional()
});
async function newsRoutes(fastify) {
    fastify.get('/', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            const news = await prisma_1.default.news.findMany({
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
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                error: 'Erro ao buscar notícias',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
    fastify.get('/:id', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        const { id } = request.params;
        try {
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            const news = await prisma_1.default.news.findUnique({
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
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                error: 'Erro ao buscar detalhes da notícia',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
    fastify.get('/create', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            if (!user?.role || user.role !== 'ADMIN') {
                return reply.status(403).send({ error: 'Acesso não autorizado' });
            }
            return reply.view('pages/news-create', {
                title: 'Criar Notícia',
                user: user,
                isEditing: false,
                newsItem: null
            });
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                error: 'Erro ao carregar página de criação de notícia',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
    fastify.post('/create', {
        preHandler: [auth_middleware_1.requireAuth],
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
            const user = await (0, fastify_custom_1.getSessionUser)(request);
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
            const news = await prisma_1.default.news.create({
                data: newsData
            });
            return reply.redirect('/dashboard');
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                error: 'Erro ao criar notícia',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
    fastify.put('/:id', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        const { id } = request.params;
        const { title, summary, content, date } = request.body;
        try {
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            const validatedData = newsSchema.parse({
                title,
                summary,
                content,
                date
            });
            const updatedNews = await prisma_1.default.news.update({
                where: { id: Number(id) },
                data: validatedData
            });
            return reply.send(updatedNews);
        }
        catch (error) {
            request.log.error(error);
            if (error instanceof zod_1.z.ZodError) {
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
    fastify.delete('/:id', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        const { id } = request.params;
        try {
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            await prisma_1.default.news.delete({
                where: { id: Number(id) }
            });
            return reply.status(204).send();
        }
        catch (error) {
            request.log.error(error);
            return reply.status(500).send({
                error: 'Erro ao deletar notícia',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
}
