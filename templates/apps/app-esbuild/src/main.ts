/**
 * module-alias/register is used to register the module alias in the project.
 * This is used to avoid the relative path hell in the project.
 * For example, instead of using `import DemoUtils from '../../../utils/demo.utils';`,
 * we can use `import DemoUtils from '@/utils/demo.utils';`.
 * The module alias is defined in the tsconfig.json file.
 *
 * For tsc build, we need to use the `tsc-alias` package to resolve the module alias.
 */
// import 'module-alias/register';
import { getDemoValue } from '@/utils';
import { configs } from '@/configs';

const main = async () => {
  const demoValue = getDemoValue();
  console.log(`APP_NAME: ${configs.name}`);
  console.log(`NODE_ENV: ${configs.env}`);
  console.log(`${demoValue}!!`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log('Hello, World!');

  const closeProcesses = (code = 1) => {
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
  process.on('SIGINT', successHandler);
};

main().catch(console.error);
