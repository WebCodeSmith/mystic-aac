"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPage = void 0;
const renderPage = (reply, page, options) => {
    const sendErrorSafely = (statusCode, message) => {
        if (!reply.sent) {
            return reply.status(statusCode).send(message);
        }
        return reply;
    };
    if (!reply) {
        return sendErrorSafely(500, 'Erro interno: Objeto de resposta inválido');
    }
    if (!page || typeof page !== 'string') {
        return sendErrorSafely(500, 'Erro interno: Nome de página inválido');
    }
    if (reply.sent) {
        return reply;
    }
    const safeOptions = {
        ...options,
        error: options.error || null,
        success: options.success || null,
        onlinePlayers: options.onlinePlayers || 0,
        title: options.title || 'Página'
    };
    try {
        return reply.view(`pages/${page}`, safeOptions);
    }
    catch (error) {
        return sendErrorSafely(500, 'Erro interno ao renderizar página');
    }
};
exports.renderPage = renderPage;
