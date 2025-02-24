"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
const zod_1 = require("zod");
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
exports.AppError = AppError;
const errorHandler = (err, request, reply) => {
    console.error(`[ERROR] ${new Date().toISOString()}:`, err);
    if (err instanceof AppError) {
        return reply.status(err.statusCode).send({ message: err.message });
    }
    if (err instanceof zod_1.ZodError) {
        return reply.status(400).send({ message: 'Dados inválidos fornecidos' });
    }
    reply.status(500).send({ message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.' });
};
exports.errorHandler = errorHandler;
const asyncHandler = (fn) => (request, reply) => Promise.resolve(fn(request, reply)).catch((err) => (0, exports.errorHandler)(err, request, reply));
exports.asyncHandler = asyncHandler;
