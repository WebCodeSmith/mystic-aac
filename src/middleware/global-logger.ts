import { FastifyRequest, FastifyReply } from 'fastify';
import logger from '../config/logger';
import { User } from '../types/express-session';

export async function globalLogger(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> {
  // Obter usuário da sessão com verificação de tipo
  const sessionUser: User | undefined = 
    request.session && typeof request.session === 'object' 
      ? (request.session as any).user 
      : undefined;

  // Registrar informações básicas da requisição
  const logData = {
    method: request.method,
    path: request.url,
    ip: request.ip,
    user: sessionUser,
    username: sessionUser?.username || 'Anônimo',
    timestamp: new Date().toISOString()
  };

  // Log de informações da requisição
  request.log.info(JSON.stringify(logData));

  // Monitorar tempo de resposta
  const start = Date.now();
  
  // Adicionar hook para calcular tempo de resposta
  reply.raw.on('finish', () => {
    const duration = Date.now() - start;
    
    // Log de conclusão da requisição
    request.log.info(JSON.stringify({
      ...logData,
      status: reply.statusCode,
      responsetime: `${duration}ms`
    }));
  });
}

// Função auxiliar para mascarar dados sensíveis
function maskSensitiveData(data: any): any {
  if (typeof data === 'object' && data !== null) {
    const maskedData = { ...data };
    
    // Mascarar campos sensíveis comuns
    const sensitiveFields = [
      'password', 
      'token', 
      'secret', 
      'authorization', 
      'credentials'
    ];

    sensitiveFields.forEach(field => {
      if (maskedData[field]) {
        maskedData[field] = '********';
      }
    });

    return maskedData;
  }
  return data;
}

// Middleware para log de erros
export function errorLogger(
  error: Error, 
  request: FastifyRequest, 
  reply: FastifyReply
): void {
  // Obter usuário da sessão com verificação de tipo
  const sessionUser: User | undefined = 
    request.session && typeof request.session === 'object' 
      ? (request.session as any).user 
      : undefined;

  // Log detalhado do erro
  request.log.error({
    message: error.message,
    stack: error.stack,
    method: request.method,
    url: request.url,
    ip: request.ip,
    user: sessionUser,
    username: sessionUser?.username || 'Anônimo',
    body: maskSensitiveData(request.body)
  });

  // Enviar resposta de erro
  reply.status(500).send({
    error: 'Erro interno do servidor',
    message: 'Ocorreu um erro inesperado'
  });
}