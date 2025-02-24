"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = characterRoutes;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const config_1 = require("../config/config");
const logger_1 = __importDefault(require("../config/logger"));
const auth_middleware_1 = require("../middleware/auth-middleware");
const prisma = new client_1.PrismaClient();
const characterCreateSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(3, 'Name must have at least 3 characters')
        .max(20, 'Name must have at most 20 characters')
        .regex(/^[a-zA-Z ]+$/, 'Name must contain only letters'),
    vocation: zod_1.z.string()
        .transform((val) => parseInt(val))
        .pipe(zod_1.z.nativeEnum(config_1.Vocation)),
    sex: zod_1.z.enum(['male', 'female']),
    world: zod_1.z.string()
});
async function characterRoutes(fastify) {
    fastify.get('/create', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        return reply.view('pages/character-create', {
            vocations: Object.values(config_1.Vocation).filter(v => typeof v === 'number')
        });
    });
    fastify.post('/create', {
        preHandler: [auth_middleware_1.requireAuth]
    }, async (request, reply) => {
        try {
            const user = request.session?.user;
            if (!user) {
                return reply.status(401).send({ error: 'Unauthorized' });
            }
            const result = characterCreateSchema.safeParse(request.body);
            if (!result.success) {
                return reply.status(400).send({
                    error: 'Invalid data',
                    details: result.error.format()
                });
            }
            const existingCharacter = await prisma.player.findUnique({
                where: { name: result.data.name }
            });
            if (existingCharacter) {
                return reply.status(409).send({
                    error: 'Character name already exists'
                });
            }
            const characterData = {
                ...config_1.defaultCharacterData,
                name: result.data.name,
                sex: result.data.sex,
                accountId: user.id,
                looktype: result.data.sex === 'male' ? 128 : 136,
                vocation: result.data.vocation
            };
            const character = await prisma.player.create({
                data: characterData
            });
            return reply.status(201).send(JSON.parse(JSON.stringify(character, (key, value) => typeof value === 'bigint' ? value.toString() : value)));
        }
        catch (error) {
            logger_1.default.error('Error creating character:', { error });
            return reply.status(500).send({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}
