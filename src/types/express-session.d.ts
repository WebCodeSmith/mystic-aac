import 'fastify'
import '@fastify/session'

// Definição de usuário baseada no modelo Account
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLogin?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Alias para compatibilidade
export type UserSession = User;

declare module '@fastify/session' {
  interface SessionData {
    user?: User | undefined;
    destroy?: () => Promise<void>;
  }
}

declare module 'fastify' {
  interface FastifySessionObject {
    user?: User | undefined;
    get(key: string): any;
    set(key: string, value: any): void;
  }

  interface FastifyRequest {
    session: FastifySessionObject & {
      destroy(): Promise<void>;
    };
  }
}