import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { AppError } from './error-handler';
import logger from '../config/logger';
import { User } from '../types/express-session';

// Estender o tipo da sessão para incluir a propriedade user
declare module '@fastify/session' {
  interface FastifySessionObject {
    user?: User;
  }
}

// Definir tipos de roles possíveis
export type UserRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'GUEST';

// Mapa de hierarquia de permissões
const ROLE_HIERARCHY: Record<UserRole, number> = {
  'GUEST': 1,
  'USER': 2,
  'MODERATOR': 3,
  'ADMIN': 4
};

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Verificação robusta da sessão
    if (!request.session) {
      logger.error('ERRO: Sessão não inicializada', {
        nodeEnv: process.env.NODE_ENV,
        url: request.url
      });
      return reply.status(401).redirect('/login');
    }

    // Verificação do usuário na sessão
    if (!request.session.user || !request.session.user.id) {
      logger.error('ERRO: Usuário inválido na sessão', {
        sessionUserType: typeof request.session.user,
        nodeEnv: process.env.NODE_ENV,
        url: request.url
      });
      return reply.status(401).redirect('/login');
    }

    // Verificação adicional de permissões
    const user = request.session.user;
    const allowedRoles = ['admin', 'player'];

    if (!allowedRoles.includes(user.role)) {
      logger.error('ERRO: Usuário sem permissão', {
        userRole: user.role,
        allowedRoles,
        nodeEnv: process.env.NODE_ENV,
        url: request.url
      });
      return reply.status(403).redirect('/unauthorized');
    }

    // Verificação de status da conta
    if (!user.isActive) {
      logger.error('ERRO: Conta inativa', {
        userId: user.id,
        nodeEnv: process.env.NODE_ENV,
        url: request.url
      });
      return reply.status(403).redirect('/account-inactive');
    }

    // Log de sucesso na autenticação
    logger.info('SUCESSO: Autenticação validada', {
      userId: user.id,
      username: user.username,
      role: user.role,
      nodeEnv: process.env.NODE_ENV,
      url: request.url
    });

    return;
  } catch (error) {
    // Log de erro inesperado
    logger.error('ERRO CRÍTICO: Falha na verificação de autenticação', {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      errorStack: error instanceof Error ? error.stack : 'Sem stack trace',
      nodeEnv: process.env.NODE_ENV,
      url: request.url
    });

    return reply.status(500).redirect('/login');
  }
};

export const checkPermission = (requiredRole: UserRole) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Obter usuário da sessão com verificação de tipo
    const user: User | undefined = 
      request.session && typeof request.session === 'object' 
        ? (request.session as any).user 
        : undefined;

    if (!user) {
      logger.warn('Tentativa de acesso não autenticado com permissão específica');
      throw new AppError('Não autorizado', 401);
    }

    const userRole = user.role as UserRole;

    // Verificar hierarquia de permissões
    if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[requiredRole]) {
      logger.warn(`Usuário ${user.username} tentou acessar recurso sem permissão`);
      throw new AppError('Permissão insuficiente', 403);
    }
  };
};

export const logUserActivity = async (request: FastifyRequest, reply: FastifyReply) => {
  // Obter usuário da sessão com verificação de tipo
  const user: User | undefined = 
    request.session && typeof request.session === 'object' 
      ? (request.session as any).user 
      : undefined;

  if (user) {
    logger.info(`Usuário ${user.username} acessou ${request.url}`);
  }
};

export const preventAuthenticatedAccess = async (request: FastifyRequest, reply: FastifyReply) => {
  // Se já estiver logado, redirecionar para dashboard
  if (request.session && (request.session as any).user) {
    return reply.redirect('/dashboard');
  }
};

// Plugin do Fastify para registrar os middlewares
export default async function authMiddleware(fastify: FastifyInstance) {
  fastify.decorateRequest('requireAuth', requireAuth);
  fastify.decorateRequest('checkPermission', checkPermission);
  fastify.decorateRequest('logUserActivity', logUserActivity);
  fastify.decorateRequest('preventAuthenticatedAccess', preventAuthenticatedAccess);
}
