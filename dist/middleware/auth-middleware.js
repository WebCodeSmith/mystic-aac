"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preventAuthenticatedAccess = exports.logUserActivity = exports.checkPermission = void 0;
exports.requireAuth = requireAuth;
exports.default = authMiddleware;
const error_handler_1 = require("./error-handler");
const ROLE_HIERARCHY = {
    'USER': 1,
    'ADMIN': 2
};
async function requireAuth(request, reply) {
    try {
        if (!request.session) {
            return reply.status(401).redirect('/login');
        }
        if (!request.session.user || !request.session.user.id) {
            return reply.status(401).redirect('/login');
        }
        const user = request.session.user;
        const allowedRoles = ['USER', 'ADMIN'];
        if (!allowedRoles.includes(user.role)) {
            return reply.status(403).redirect('/unauthorized');
        }
        if (!user.isActive) {
            return reply.status(403).redirect('/account-inactive');
        }
        return;
    }
    catch (error) {
        return reply.status(500).redirect('/login');
    }
}
;
const checkPermission = (requiredRole) => {
    return async (request, reply) => {
        const user = request.session && typeof request.session === 'object'
            ? request.session.user
            : undefined;
        if (!user) {
            throw new error_handler_1.AppError('Não autorizado', 401);
        }
        const userRole = user.role;
        if (ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[requiredRole]) {
            throw new error_handler_1.AppError('Permissão insuficiente', 403);
        }
    };
};
exports.checkPermission = checkPermission;
const logUserActivity = async (request, reply) => {
    const user = request.session && typeof request.session === 'object'
        ? request.session.user
        : undefined;
    if (user) {
    }
};
exports.logUserActivity = logUserActivity;
const preventAuthenticatedAccess = async (request, reply) => {
    if (request.session && request.session.user) {
        return reply.redirect('/dashboard');
    }
};
exports.preventAuthenticatedAccess = preventAuthenticatedAccess;
async function authMiddleware(fastify) {
    fastify.decorateRequest('requireAuth', requireAuth);
    fastify.decorateRequest('checkPermission', exports.checkPermission);
    fastify.decorateRequest('logUserActivity', exports.logUserActivity);
    fastify.decorateRequest('preventAuthenticatedAccess', exports.preventAuthenticatedAccess);
}
