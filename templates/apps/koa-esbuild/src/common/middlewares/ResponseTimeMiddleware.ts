import { duration } from '@/utils/time';
import { Context } from 'koa';
import { KoaMiddlewareInterface, Middleware } from 'routing-controllers';

@Middleware({ type: 'before' })
export class ResponseTimeMiddleware implements KoaMiddlewareInterface {
  async use(context: Context, next: (err?: any) => Promise<any>): Promise<any> {
    const nextDuration = duration(next);
    const { ms } = await nextDuration(context);
    context.set('X-Response-Time', `${ms}ms`);
  }
}
