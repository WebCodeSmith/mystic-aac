// Este arquivo foi renomeado para fastify-custom.ts
import { FastifyRequest } from 'fastify';
import '@fastify/session';
import { UserSession } from './fastify-session';

export type AuthenticatedRequest = FastifyRequest & {
  session: {
    user?: UserSession;
    get(key: string): any;
    set(key: string, value: any): void;
    destroy(): Promise<void>;
  };
}