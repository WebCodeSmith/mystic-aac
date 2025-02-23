import { 
    FastifyInstance, 
    FastifyRequest, 
    FastifyReply
} from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { defaultCharacterData, Vocation } from '../config/config';
import logger from '../config/logger';
import { requireAuth } from '../middleware/auth-middleware';
import { UserSession } from '../types/fastify-session';

const prisma = new PrismaClient();

interface CreateCharacterBody {
    name: string;
    vocation: Vocation;
    sex: 'male' | 'female';
    world: string;
}

interface CreateCharacterRoute {
    Body: CreateCharacterBody;
}

const characterCreateSchema = z.object({
    name: z.string()
        .min(3, 'Name must have at least 3 characters')
        .max(20, 'Name must have at most 20 characters')
        .regex(/^[a-zA-Z ]+$/, 'Name must contain only letters'),
    vocation: z.string()
        .transform((val) => parseInt(val))
        .pipe(z.nativeEnum(Vocation)),
    sex: z.enum(['male', 'female']),
    world: z.string()
});

export default async function characterRoutes(fastify: FastifyInstance) {
    // GET route for character creation form
    fastify.get('/create', {
        preHandler: [requireAuth]
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.view('pages/character-create', { 
            vocations: Object.values(Vocation).filter(v => typeof v === 'number')
        });
    });

    // POST route for character creation
    fastify.post<CreateCharacterRoute>('/create', {
        preHandler: [requireAuth]
    }, async (request: FastifyRequest<CreateCharacterRoute>, reply: FastifyReply) => {
        try {
            const user = request.session?.user as UserSession;
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

            // Create character base data
            const characterData = {
                ...defaultCharacterData,  // Primeiro aplicamos os dados padrão
                name: result.data.name,
                sex: result.data.sex,
                accountId: user.id,
                looktype: result.data.sex === 'male' ? 128 : 136,
                vocation: result.data.vocation  // Depois sobrescrevemos a vocação
            };

            // Dentro da rota POST, após criar o personagem
            const character = await prisma.player.create({
                data: characterData
            });

            // Converter BigInt para string antes de enviar
            return reply.status(201).send(JSON.parse(JSON.stringify(
                character,
                (key, value) => typeof value === 'bigint' ? value.toString() : value
            )));
        } catch (error) {
            logger.error('Error creating character:', { error });
            return reply.status(500).send({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
}
