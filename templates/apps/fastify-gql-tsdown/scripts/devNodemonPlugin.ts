/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from 'node:child_process';
// import tsdown from 'tsdown';

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
  let watchMode = false;
  return {
    name,
    buildStart(options: any) {
      // 1) Rollup watch options（有時候會是物件）
      watchMode = Boolean(options.watch);

      // 2) 或用 this.meta.watchMode（若你的 Rollup 版本支援）
      watchMode = Boolean((this as any).meta?.watchMode) || watchMode;
    },
    writeBundle() {
      if (watchMode && !started) {
        started = true;
        console.log('Starting nodemon...');
        devNodemonFn();
        started = false;
        console.log('Nodemon started successfully');
      }
    },
  };
}

export const tsdownDevNodemonPlugin = () =>
  devNodemonPlugin({
    type: 'tsdown',
  });
