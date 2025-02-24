"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const logDir = path_1.default.join(__dirname, '../../logs');
const logger = winston_1.default.createLogger({
    level: process.env.LOGGING_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.splat(), winston_1.default.format.json()),
    defaultMeta: { service: 'server' },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logDir, 'combined.log'),
            maxsize: 5242880,
            maxFiles: 5
        })
    ]
});
exports.default = logger;
