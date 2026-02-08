import * as Koa from 'koa';
import { ApiResError } from '@/common/types';
import { HttpException } from '@/common/exceptions';
import { Logger } from 'winston';

export const KoaLoggerHttpErrorMiddleware = (logger?: Logger) => {
  return async (ctx: Koa.Context, next: Koa.Next) => {
    await KoaHttpErrorInterceptor(ctx, next, logger);
  };
};

export const KoaHttpErrorInterceptor = async (
  ctx: Koa.Context,
  next: Koa.Next,
  logger?: Logger,
) => {
  try {
    await next();
    const body = ctx.body ?? {};
    if (body && body['status']) {
      body['status'] = ctx.status;
    }
  } catch (error) {
    koaErrorHandler(error, ctx, logger);
  }
};

export const koaErrorHandler = (error: Error, ctx: Koa.Context, logger?: Logger) => {
  const isInnerError = error instanceof HttpException;
  if (!isInnerError) {
    error = new HttpException(error.message, 500);
  }
  const httpError = error as HttpException;
  const body: ApiResError = {
    success: false,
    status: httpError.status,
    errorCode: httpError.errorCode,
    message: error.message,
    method: ctx.method,
    path: ctx.path,
    timestamp: new Date(),
  };
  if (httpError.description) {
    body.description = httpError.description;
  }
  if (logger) {
    logger.error(httpError.stack);
  } else {
    console.error(httpError);
  }
  ctx.status = httpError.status ?? 500;
  ctx.body = body;
  return error;
};
