import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import path from 'path';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: Error, 
  request: FastifyRequest, 
  reply: FastifyReply
) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

  if (err instanceof AppError) {
    return reply.status(err.statusCode).send({ message: err.message });
  }

  if (err instanceof ZodError) {
    return reply.status(400).send({ message: 'Dados inválidos fornecidos' });
  }

  // Tratamento genérico para erros não mapeados
  reply.status(500).send({ message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.' });
};

export const asyncHandler = (fn: Function) => 
  (request: FastifyRequest, reply: FastifyReply) => 
    Promise.resolve(fn(request, reply)).catch((err: Error) => errorHandler(err, request, reply));
