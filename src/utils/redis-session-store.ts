import Redis from 'ioredis';
import { SessionStore } from '@fastify/session';

export function createRedisSessionStore(redisClient: Redis): SessionStore {
  return {
    set: (sessionId: string, session: any, callback: (err?: Error | null) => void) => {
      const sessionTTL = session.cookie?.originalMaxAge 
        ? Math.floor(session.cookie.originalMaxAge / 1000) 
        : 86400; // 24 horas por padrão

      const sessionCopy = { ...session };
      delete sessionCopy.cookie;

      redisClient.set(
        sessionId, 
        JSON.stringify(sessionCopy), 
        'EX', 
        sessionTTL,
        (err) => {
          callback(err);
        }
      );
    },
    get: (sessionId: string, callback: (err?: Error | null, session?: any) => void) => {
      redisClient.get(sessionId, (err, sessData) => {
        if (err) {
          return callback(err);
        }

        try {
          const sess = sessData ? JSON.parse(sessData) : null;
          callback(null, sess);
        } catch (parseErr) {
          callback(parseErr as Error);
        }
      });
    },
    destroy: (sessionId: string, callback: (err?: Error | null) => void) => {
      redisClient.del(sessionId, callback);
    }
  };
}
