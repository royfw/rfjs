// devNodemonPlugin.js
import { spawn } from 'node:child_process';

const devNodemonFn = (options = {}) => {
  const { entry = 'dist/main.js' } = options;

  // 執行 nodemon 的方式
  const nodemonArgs = [
    // '--watch', 'dist',
    '--ext',
    'js',
    '--exec',
    `\"node ${entry}\"`,
  ];

  // 啟動 nodemon 進程
  const child = spawn('npx', ['nodemon', ...nodemonArgs], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code) => {
    console.log(`nodemon exited with code ${code}`);
  });
};

export function devNodemonPlugin(options = {}) {
  const { type } = options;
  const name = type ? `${type}-dev-nodemon-plugin` : 'dev-nodemon-plugin';
  switch (type) {
    case 'esbuild':
      return {
        name,
        setup(build) {
          if (build.errors && build.errors.length) {
            console.error('Build errors:', build.errors);
            return;
          }
          build.onEnd(() => {
            devNodemonFn();
          });
        },
      };
    case 'rollup':
      return {
        name,
        writeBundle() {
          if (this.meta.watchMode) {
            devNodemonFn();
          }
        },
      };
    default:
      return devNodemonFn();
  }
}

export const esbuildDevNodemonPlugin = () =>
  devNodemonPlugin({
    type: 'esbuild',
  });

export const rollupDevNodemonPlugin = () =>
  devNodemonPlugin({
    type: 'rollup',
  });
