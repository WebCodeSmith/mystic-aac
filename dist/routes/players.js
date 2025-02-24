"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = playerRoutes;
const prisma_1 = __importDefault(require("../services/prisma"));
const auth_middleware_1 = require("../middleware/auth-middleware");
async function playerRoutes(fastify) {
    fastify.get('/', async (request, reply) => {
        const { page = 1, limit = 10, vocation, minLevel } = request.query;
        const skip = (page - 1) * limit;
        const whereCondition = {
            ...(vocation && { vocation: Number(vocation) }),
            ...(minLevel && { level: { gte: minLevel } })
        };
        try {
            const [total, players] = await Promise.all([
                prisma_1.default.player.count({ where: whereCondition }),
                prisma_1.default.player.findMany({
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
        }
        catch (error) {
            request.log.error(error);
            reply.status(500).send({
                error: 'Erro ao buscar jogadores',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
    fastify.get('/:id', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        const { id } = request.params;
        try {
            const player = await prisma_1.default.player.findUnique({
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
        }
        catch (error) {
            request.log.error(error);
            reply.status(500).send({
                error: 'Erro ao buscar detalhes do jogador',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
    fastify.put('/:id', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        const { id } = request.params;
        const { name, avatar, vocation } = request.body;
        try {
            const updatedPlayer = await prisma_1.default.player.update({
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
        }
        catch (error) {
            request.log.error(error);
            reply.status(500).send({
                error: 'Erro ao atualizar perfil do jogador',
                message: error instanceof Error ? error.message : 'Erro desconhecido'
            });
        }
    });
}
