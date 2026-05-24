import { bodyParser } from '@koa/bodyparser';
import cors from '@koa/cors';
import logger from 'koa-logger';
import koa from 'koa';
import { RoutingControllersOptions, useKoaServer } from 'routing-controllers';
import { buildApiDocs } from './openapi';
import { KoaLoggerHttpErrorMiddleware } from './common/interceptors';

export function initKoaApp(
  routingControllerOptions: RoutingControllersOptions = {},
  isApiDocEnabled = true,
) {
  const app = new koa();
  app.use(KoaLoggerHttpErrorMiddleware());

  app.use(logger());

  useKoaServer(app, routingControllerOptions);

  app.use(
    cors({
      origin(ctx) {
        return ctx.get('Origin') || '*';
      },
    }),
  );

  app.use(
    bodyParser({
      formLimit: '100mb',
      jsonLimit: '100mb',
      textLimit: '100mb',
      encoding: 'utf-8',
    }),
  );

  buildApiDocs(app, routingControllerOptions, isApiDocEnabled);

  return app;
}
