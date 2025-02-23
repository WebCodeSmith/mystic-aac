import path from 'path';
import { FastifyReply } from 'fastify';
import logger from '../config/logger';

export const renderPage = (
  reply: FastifyReply, 
  page: string, 
  options: { 
    title: string, 
    error?: string, 
    success?: string,
    onlinePlayers?: number,
    message?: string,
    [key: string]: any
  }
) => {
  // Função para enviar resposta de erro de forma segura
  const sendErrorSafely = (statusCode: number, message: string) => {
    if (!reply.sent) {
      return reply.status(statusCode).send(message);
    }
    return reply;
  };

  // Validações iniciais
  if (!reply) {
    return sendErrorSafely(500, 'Erro interno: Objeto de resposta inválido');
  }

  if (!page || typeof page !== 'string') {
    return sendErrorSafely(500, 'Erro interno: Nome de página inválido');
  }

  // Verificar se a resposta já foi enviada
  if (reply.sent) {
    return reply;
  }

  // Preparar opções seguras
  const safeOptions = {
    ...options,
    error: options.error || null,
    success: options.success || null,
    onlinePlayers: options.onlinePlayers || 0,
    title: options.title || 'Página'
  };

  try {
    // Renderização direta
    return reply.view(`pages/${page}`, safeOptions);
  } catch (error) {
    // Enviar erro de forma segura
    return sendErrorSafely(500, 'Erro interno ao renderizar página');
  }
};
