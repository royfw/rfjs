/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from 'node:child_process';
import esbuild from 'esbuild';

let nodemonProcess: any = null;

type DevNodemonFnOptions = {
  entry?: string;
};

const devNodemonFn = (options: DevNodemonFnOptions = {}) => {
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
    `"node ${entry}"`,
  ];

  nodemonProcess = spawn('npx', ['nodemon', ...nodemonArgs], {
    stdio: 'inherit',
    shell: true,
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  nodemonProcess.on('close', (code: number) => {
    console.log(`nodemon exited with code ${code}`);
    nodemonProcess = null;
  });
};

type DevNodemonPluginOptions = {
  type?: string;
};

function devNodemonPlugin(options: DevNodemonPluginOptions = {}) {
  const { type } = options;
  const name = type ? `${type}-dev-nodemon-plugin` : 'dev-nodemon-plugin';
  let started = false;
  return {
    name,
    setup(build: esbuild.PluginBuild) {
      build.onEnd(() => {
        if (!started) {
          started = true;
          devNodemonFn();
          started = false;
        }
      });
    },
  };
}

export const esbuildDevNodemonPlugin = () =>
  devNodemonPlugin({
    type: 'esbuild',
  });
