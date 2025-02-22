import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

declare module 'fastify-rate-limit' {
  interface RateLimitOptions {
    max?: number;
    timeWindow?: string | number;
    keyGenerator?: (request: FastifyRequest) => string;
    errorResponseBuilder?: (request: FastifyRequest, context: { 
      max: number; 
      timeWindow: string | number 
    }) => { 
      statusCode: number; 
      error: string; 
      message: string 
    };
  }

  export default function fastifyRateLimit(
    instance: FastifyInstance, 
    opts: RateLimitOptions, 
    next: (err?: Error) => void
  ): void;
}
