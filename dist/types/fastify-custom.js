"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionUser = getSessionUser;
require("@fastify/session");
function getSessionUser(request) {
    return request.session && typeof request.session === 'object'
        ? request.session.user
        : undefined;
}
