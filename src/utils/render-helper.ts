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
    logger.error('Objeto de resposta inválido');
    return sendErrorSafely(500, 'Erro interno: Objeto de resposta inválido');
  }

  if (!page || typeof page !== 'string') {
    logger.error('Nome de página inválido', { page });
    return sendErrorSafely(500, 'Erro interno: Nome de página inválido');
  }

  // Verificar se a resposta já foi enviada
  if (reply.sent) {
    logger.warn('Tentativa de renderizar página já enviada', { page });
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

  // Log de diagnóstico
  logger.info('Tentativa de renderização de página', {
    page,
    replySent: reply.sent,
    title: safeOptions.title
  });

  try {
    // Renderização direta
    return reply.view(`pages/${page}`, safeOptions);
  } catch (error) {
    // Log de erro detalhado
    logger.error('Erro inesperado ao renderizar página', {
      page,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      stack: error instanceof Error ? error.stack : 'Sem stack trace'
    });

    // Enviar erro de forma segura
    return sendErrorSafely(500, 'Erro interno ao renderizar página');
  }
};
