"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisSessionStore = createRedisSessionStore;
function createRedisSessionStore(redisClient) {
    return {
        set: (sessionId, session, callback) => {
            const sessionTTL = session.cookie?.originalMaxAge
                ? Math.floor(session.cookie.originalMaxAge / 1000)
                : 86400;
            const sessionCopy = { ...session };
            delete sessionCopy.cookie;
            redisClient.set(sessionId, JSON.stringify(sessionCopy), 'EX', sessionTTL, (err) => {
                callback(err);
            });
        },
        get: (sessionId, callback) => {
            redisClient.get(sessionId, (err, sessData) => {
                if (err) {
                    return callback(err);
                }
                try {
                    const sess = sessData ? JSON.parse(sessData) : null;
                    callback(null, sess);
                }
                catch (parseErr) {
                    callback(parseErr);
                }
            });
        },
        destroy: (sessionId, callback) => {
            redisClient.del(sessionId, callback);
        }
    };
}
