import { spawn } from 'node:child_process';

let nodemonProcess = null;

const devNodemonFn = (options = {}) => {
  const { entry = 'dist/main.js' } = options;

  if (nodemonProcess) {
    // nodemon 本來就會自動 reload，不要重複 spawn
    return;
  }

  // 執行 nodemon 的方式
  const nodemonArgs = [
    // '--watch', 'dist',
    '--ext',
    'js',
    '--exec',
    `\"node ${entry}\"`,
  ];

  nodemonProcess = spawn('npx', ['nodemon', ...nodemonArgs], {
    stdio: 'inherit',
    shell: true,
  });

  nodemonProcess.on('close', (code) => {
    console.log(`nodemon exited with code ${code}`);
    nodemonProcess = null;
  });
};

export function devNodemonPlugin(options = {}) {
  const { type } = options;
  const name = type ? `${type}-dev-nodemon-plugin` : 'dev-nodemon-plugin';
  let started = false;
  switch (type) {
    case 'esbuild':
      return {
        name,
        setup(build) {
          build.onEnd(() => {
            if (!started) {
              started = true;
              devNodemonFn();
              started = false;
            }
          });
        },
      };
    case 'rollup':
      return {
        name,
        writeBundle() {
          if (this.meta.watchMode && !started) {
            started = true;
            devNodemonFn();
            started = false;
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
