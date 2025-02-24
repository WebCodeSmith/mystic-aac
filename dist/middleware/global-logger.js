"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalLogger = globalLogger;
exports.errorLogger = errorLogger;
async function globalLogger(request, reply) {
    const sessionUser = request.session && typeof request.session === 'object'
        ? request.session.user
        : undefined;
    const logData = {
        method: request.method,
        path: request.url,
        ip: request.ip,
        user: sessionUser,
        username: sessionUser?.username || 'Anônimo',
        timestamp: new Date().toISOString()
    };
    const logLevel = process.env.LOGGING_LEVEL || 'info';
    if (logLevel !== 'error') {
        request.log.info(JSON.stringify(logData));
    }
    const start = Date.now();
    reply.raw.on('finish', () => {
        const duration = Date.now() - start;
        if (logLevel !== 'error') {
            request.log.info(JSON.stringify({
                ...logData,
                status: reply.statusCode,
                responsetime: `${duration}ms`
            }));
        }
    });
}
function maskSensitiveData(data) {
    if (typeof data === 'object' && data !== null) {
        const maskedData = { ...data };
        const sensitiveFields = [
            'password',
            'token',
            'secret',
            'authorization',
            'credentials'
        ];
        sensitiveFields.forEach(field => {
            if (maskedData[field]) {
                maskedData[field] = '********';
            }
        });
        return maskedData;
    }
    return data;
}
function errorLogger(error, request, reply) {
    const sessionUser = request.session && typeof request.session === 'object'
        ? request.session.user
        : undefined;
    request.log.error({
        message: error.message,
        stack: error.stack,
        method: request.method,
        url: request.url,
        ip: request.ip,
        user: sessionUser,
        username: sessionUser?.username || 'Anônimo',
        body: maskSensitiveData(request.body)
    });
    reply.status(500).send({
        error: 'Erro interno do servidor',
        message: 'Ocorreu um erro inesperado'
    });
}
