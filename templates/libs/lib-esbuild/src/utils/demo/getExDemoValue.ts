import { getDemoValue } from './getDemoValue';
/**
 * 使用 alias
 * import { getDemoValue } from '@/utils';
 *
 * 未編譯 src/index.ts，外部使用會報錯
 * - tsc
 *   error TS2307: Cannot find module '@/utils' or its corresponding type declarations.
 * - rollup
 *   Additionally, handling the error in the 'buildEnd' hook caused the following error:
 *   [plugin rpt2] ../../../ts-template/src/utils/demo/exDemo.utils.ts:3:30 - error TS2307: Cannot find module '@/utils' or its corresponding type declarations.
 *
 * 編譯 dist，rollup 編譯能使用
 * - tsc
 */
export const getExDemoValue = () => {
  const demo = getDemoValue();
  return `~~ex ${demo}`;
};
