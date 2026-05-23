import { RoutingControllersOptions, getMetadataArgsStorage } from 'routing-controllers';
import { routingControllersToSpec } from 'routing-controllers-openapi';
import { defaultMetadataStorage } from 'class-transformer/cjs/storage';
import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { getMetadataStorage } from 'class-validator';
import { configs } from '@/configs';
import koa from 'koa';
import { koaSwagger } from 'koa2-swagger-ui';
import Router from '@koa/router';

/**
 *
 * @param routingControllerOptions RoutingControllersOptions
 * @param additionalProperties Partial<OpenAPIObject>
 */

export function getSwaggerSpec(routingControllerOptions?: RoutingControllersOptions) {
  // routing-controllers-openapi example:
  // https://github.com/epiphone/routing-controllers-openapi/blob/master/sample/01-basic/app.ts
  try {
    const storage = getMetadataArgsStorage();
    const classValidatorMetadataStorage = getMetadataStorage();

    const schemas = validationMetadatasToSchemas({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      classTransformerMetadataStorage: defaultMetadataStorage,
      classValidatorMetadataStorage,
      refPointerPrefix: '#/components/schemas/',
    });

    const spec = routingControllersToSpec(storage, routingControllerOptions, {
      components: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        schemas: Object(schemas),
      },
      info: {
        title: configs.name,
        version: configs.version ?? 'v0.0.0',
        description: configs.description ?? `${configs.description} rest api`,
      },
    });
    return spec;
  } catch (err) {
    if (err instanceof Error) {
      const msg: string = err.message; // ok
      const errInfo = `[DOC][getSwaggerSpec] error: ${msg}`;
      console.error(errInfo);
      console.error(err);
    }
    return null;
  }
}

export function buildApiDocs(
  app: koa<koa.DefaultState, koa.DefaultContext>,
  routingControllerOptions: RoutingControllersOptions,
  isApiDocEnabled: boolean,
) {
  const spec = getSwaggerSpec(routingControllerOptions);

  if (isApiDocEnabled && spec) {
    app.use(async (ctx, next) => {
      if (ctx.path === '/swagger.json') {
        ctx.body = spec;
      } else {
        await next();
      }
    });
    app.use(
      koaSwagger({
        routePrefix: '/api-docs',
        swaggerOptions: {
          url: '/swagger.json',
        },
      }),
    );

    const router = new Router();
    router.get('/', (ctx) => {
      ctx.redirect('/api-docs');
    });
    app.use(router.routes());
  }
}
