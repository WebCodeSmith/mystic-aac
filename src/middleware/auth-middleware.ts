import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler';
import logger from '../config/logger';
import { User } from '../types/express-session';

// Definir tipos de roles possíveis
export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'GUEST';

// Mapa de hierarquia de permissões
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'GUEST': 1,
  'USER': 2,
  'MODERATOR': 3,
  'ADMIN': 4
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {

  // Verificações múltiplas de autenticação
  if (!req.session) {
    logger.warn('Sessão não inicializada');
    return res.status(401).redirect('/login');
  }

  if (!req.session.user) {
    logger.warn('Tentativa de acesso não autenticado');
    console.log('Session details:', req.session); // Add this line for more context
    return res.status(401).redirect('/login');
  }

  // Verificação adicional de integridade do usuário
  const user = req.session.user as User;
  if (!user.id || !user.username) {
    logger.error('Dados de usuário inválidos na sessão');
    delete req.session.user;
    return res.status(401).redirect('/login');
  }

  next();
};

export const checkPermission = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      logger.warn('Tentativa de acesso não autenticado com permissão específica');
      throw new AppError('Não autorizado', 401);
    }

    const user = req.session.user as User;
    const userRole = user.role as UserRole;

    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[requiredRole]) {
      logger.warn(`Usuário ${user.username} tentou acessar recurso sem permissão`);
      throw new AppError('Permissão insuficiente', 403);
    }

    next();
  };
};

export const logUserActivity = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user) {
    const user = req.session.user as User;
    logger.info(`Usuário ${user.username} acessou ${req.path}`);
  }
  next();
};

export const preventAuthenticatedAccess = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.user) {
    const user = req.session.user as User;
    logger.warn(`Usuário ${user.username} tentou acessar página de login/registro já autenticado`);
    return res.redirect('/dashboard');
  }
  next();
};
