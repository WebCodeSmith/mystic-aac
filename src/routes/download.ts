import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function downloadRoutes(fastify: FastifyInstance) {
    // Rota para a página de downloads
    fastify.get('/download', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            return reply.view('pages/download', {
                title: 'Downloads'
            });
        } catch (error) {
            return reply.status(500).send({ error: 'Erro interno ao carregar a página de downloads' });
        }
    });
}
