import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { JsonbQueryError } from '@rfjs/jsonb-query';

/**
 * Maps known error types to HTTP responses. ZodError (validation) -> 400,
 * without leaking raw internal error details to the client. Everything else
 * falls through to Fastify's default handling (which honors error.statusCode,
 * e.g. @fastify/sensible httpErrors, otherwise 500).
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.info({ issues: error.issues }, 'request validation failed');
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request validation failed',
        issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
    }
    if (error instanceof JsonbQueryError) {
      request.log.info({ code: error.code }, 'jsonb filter build failed');
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid filter',
        code: error.code,
      });
    }
    // Preserve default behavior for all other errors.
    reply.send(error);
  });
}
