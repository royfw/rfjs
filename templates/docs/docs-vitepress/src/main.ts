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
import DemoUtils from '@/utils/demo.utils';
import { configs } from '@/configs';

const main = async () => {
  const demoValue = DemoUtils.getDemoValue();
  console.log(`APP_NAME: ${configs.name}`);
  console.log(`NODE_ENV: ${configs.env}`);
  console.log(`${demoValue}!!`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log('Hello, World!');
};

main().catch(console.error);
