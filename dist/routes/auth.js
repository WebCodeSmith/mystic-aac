"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const prisma_1 = __importDefault(require("../services/prisma"));
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth-middleware");
const fastify_custom_1 = require("../types/fastify-custom");
const logger_1 = __importDefault(require("../config/logger"));
const config_service_1 = require("../services/config.service");
const render_helper_1 = require("../utils/render-helper");
const config_1 = require("../config/config");
const ONLINE_PLAYERS_COUNT = 42;
const renderPageWithOnlinePlayers = async (reply, page, options) => {
    if (!reply || !page) {
        logger_1.default.error('Parâmetros inválidos para renderização', {
            reply: !!reply,
            page
        });
        return reply.status(500).send('Erro interno: Parâmetros de renderização inválidos');
    }
    if (reply.sent) {
        logger_1.default.warn('Tentativa de renderizar página já enviada', { page });
        return reply;
    }
    try {
        return (0, render_helper_1.renderPage)(reply, page, {
            ...options,
            onlinePlayers: ONLINE_PLAYERS_COUNT
        });
    }
    catch (error) {
        logger_1.default.error('Erro ao renderizar página com jogadores online', {
            page,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            stack: error instanceof Error ? error.stack : 'Sem stack trace'
        });
        if (!reply.sent) {
            return reply.status(500).send('Erro interno ao renderizar página');
        }
        return reply;
    }
};
const characterCreateSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(3, 'O nome deve ter pelo menos 3 caracteres')
        .max(20, 'O nome deve ter no máximo 20 caracteres')
        .regex(/^[a-zA-Z ]+$/, 'O nome deve conter apenas letras'),
    vocation: zod_1.z.enum(['Knight', 'Paladin', 'Sorcerer', 'Druid']),
    sex: zod_1.z.enum(['male', 'female']),
    world: zod_1.z.string()
});
async function authRoutes(fastify) {
    const configService = new config_service_1.ConfigService();
    fastify.get('/', async (request, reply) => {
        try {
            const news = await prisma_1.default.news.findMany({
                orderBy: {
                    date: 'desc'
                },
                take: 5,
                include: {
                    author: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            });
            const formattedNews = news.map(item => ({
                id: item.id,
                title: item.title,
                summary: item.summary,
                content: item.content,
                date: item.date,
                authorName: item.author?.username || 'Sistema'
            }));
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            return reply.view('pages/index', {
                title: 'Início',
                user,
                news: formattedNews,
                onlinePlayers: ONLINE_PLAYERS_COUNT,
                serverName: configService.get('serverName') || 'Mystic AAC'
            });
        }
        catch (error) {
            logger_1.default.error('Erro ao renderizar página inicial:', error);
            return reply.status(500).send('Erro ao carregar página inicial');
        }
    });
    fastify.get('/dashboard', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            if (!request.session?.user?.id) {
                return reply.redirect('/login');
            }
            const user = request.session.user;
            const players = await prisma_1.default.player.findMany({
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
            });
            const player = await prisma_1.default.player.findFirst({
                where: { accountId: user.id }
            });
            const news = await prisma_1.default.news.findMany({
                orderBy: { date: 'desc' },
                take: 5,
                select: {
                    id: true,
                    title: true,
                    summary: true,
                    date: true,
                    author: {
                        select: {
                            id: true,
                            username: true
                        }
                    }
                }
            });
            return reply.view('pages/dashboard', {
                title: 'Painel do Jogador',
                user,
                player,
                players,
                news,
                getVocationName: config_1.getVocationName,
                serverName: configService.get('serverName') || 'Mystic AAC'
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
            logger_1.default.error('Erro ao acessar o dashboard', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : 'Sem stack trace'
            });
            return reply.view('pages/error', {
                title: 'Erro',
                message: errorMessage || 'Ocorreu um erro inesperado.'
            });
        }
    });
    fastify.all('/logout', async (request, reply) => {
        try {
            await request.session.destroy();
            return reply.redirect('/');
        }
        catch (error) {
            logger_1.default.error('Erro ao fazer logout', error);
            return reply.status(500).send('Erro ao fazer logout');
        }
    });
    fastify.get('/download', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            const user = await (0, fastify_custom_1.getSessionUser)(request);
            return renderPageWithOnlinePlayers(reply, 'download', {
                title: 'Download Game',
                user
            });
        }
        catch (error) {
            logger_1.default.error('Error accessing download page:', error);
            return reply.status(500).send('Error loading download page');
        }
    });
    fastify.get('/highscores', async (request, reply) => {
        try {
            const topPlayers = await prisma_1.default.player.findMany({
                orderBy: [
                    { level: 'desc' },
                    { experience: 'desc' }
                ],
                take: 50,
                select: {
                    name: true,
                    level: true,
                    vocation: true,
                    experience: true
                }
            });
            const formattedPlayers = topPlayers.map(player => ({
                ...player,
                vocation: (0, config_1.getVocationName)(player.vocation)
            }));
            return reply.view('pages/ranking', {
                title: 'Ranking - Top Players',
                topPlayers: formattedPlayers,
                serverName: configService.get('serverName') || 'Mystic AAC',
                user: request.session?.user
            });
        }
        catch (error) {
            logger_1.default.error('Erro ao carregar ranking:', error);
            return reply.status(500).view('pages/error', {
                title: 'Erro',
                message: 'Falha ao carregar ranking'
            });
        }
    });
}
