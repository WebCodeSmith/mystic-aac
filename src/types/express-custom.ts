import { FastifyRequest } from 'fastify';
import '@fastify/session';
import { UserSession } from './express-session';

export type AuthenticatedRequest = FastifyRequest & {
  session: {
    user?: UserSession;
    get(key: string): any;
    set(key: string, value: any): void;
    destroy(): Promise<void>;
  };
}