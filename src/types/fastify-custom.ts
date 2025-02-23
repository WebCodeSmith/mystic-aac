// Este arquivo foi renomeado para fastify-custom.ts
import { FastifyRequest } from 'fastify';
import '@fastify/session';
import { UserSession, User } from './fastify-session';

export type AuthenticatedRequest = FastifyRequest & {
  session: {
    user?: UserSession;
    get(key: string): any;
    set(key: string, value: any): void;
    destroy(): Promise<void>;
  };
}

// Função auxiliar para obter usuário da sessão
type SessionUser = User | undefined;
export function getSessionUser(request: FastifyRequest): SessionUser {
    return request.session && typeof request.session === 'object' 
        ? (request.session as any).user 
        : undefined;
}