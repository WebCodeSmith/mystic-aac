import { Request } from 'express';
import { Session, SessionData } from 'express-session';

export interface UserSession {
  id: number;
  username: string;
  email: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  session: Session & Partial<SessionData> & {
    user?: UserSession;
  };
}
