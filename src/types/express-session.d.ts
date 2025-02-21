import 'express-session';
import { Session, SessionData } from 'express-session';

// Definição de usuário
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

declare module 'express-session' {
  interface SessionData {
    user?: User;
    destroy?: (callback: (err?: any) => void) => void;
  }
}

declare module 'express' {
  interface Request {
    session: Session & Partial<SessionData> & {
      [key: string]: any;
    };
  }
}
