import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export function globalLogger(req: Request, res: Response, next: NextFunction) {
  // Registrar informações básicas da requisição
  const logData = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    user: req.session?.user?.username || 'Anônimo',
    timestamp: new Date().toISOString()
  };

  // Log de informações da requisição
  logger.info(JSON.stringify(logData));

  // Adicionar usuário aos locals para uso em views
  res.locals.user = req.session?.user || null;

  // Monitorar tempo de resposta
  const start = Date.now();
  
  // Substituir o método end original para calcular o tempo de resposta
  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    const duration = Date.now() - start;
    
    // Log de conclusão da requisição
    logger.info(JSON.stringify({
      ...logData,
      status: res.statusCode,
      responsetime: `${duration}ms`
    }));

    return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
  };

  next();
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
export function errorLogger(err: Error, req: Request, res: Response, next: NextFunction) {
  const errorData = {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    user: req.session?.user?.username || 'Anônimo',
    timestamp: new Date().toISOString(),
    body: maskSensitiveData(req.body)
  };

  logger.error(JSON.stringify(errorData));
  next(err);
}
