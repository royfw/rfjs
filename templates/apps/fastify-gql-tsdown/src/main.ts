import { FastifyServerManager, HttpRouteModule } from '@/infrastructures';
import * as _indexHttpRouteModules from '@/delivery/http';

const main = async () => {
  const httpRouteModules = Object.values(
    _indexHttpRouteModules,
  ).values() as unknown as HttpRouteModule[];

  const serverManager = new FastifyServerManager({
    httpRouteModules,
  });

  try {
    await serverManager.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log('server started!');

  /* const closeProcesses = (code = 1) => {
    process.exit(code);
  };

  const successHandler = () => {
    console.info('');
    console.info('SIGTERM received');
    closeProcesses(0);
  };

  const failureHandler = (error: any) => {
    console.info('');
    console.error('Uncaught Exception');
    console.error(error);
    closeProcesses(1);
  };

  process.on('uncaughtException', failureHandler);
  process.on('unhandledRejection', failureHandler);

  process.on('SIGTERM', successHandler);
  process.on('SIGINT', successHandler); */
};

main().catch(console.error);
