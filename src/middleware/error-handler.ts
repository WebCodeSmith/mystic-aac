import { Request, Response, NextFunction } from 'express';
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
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).render(path.join(__dirname, '../../views/pages/error'), {
      title: 'Erro',
      message: err.message
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).render(path.join(__dirname, '../../views/pages/error'), {
      title: 'Erro de Validação',
      message: 'Dados inválidos fornecidos'
    });
  }

  // Tratamento genérico para erros não mapeados
  res.status(500).render(path.join(__dirname, '../../views/pages/error'), {
    title: 'Erro Interno',
    message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.'
  });
};

export const asyncHandler = (fn: Function) => 
  (req: Request, res: Response, next: NextFunction) => 
    Promise.resolve(fn(req, res, next)).catch(next);
