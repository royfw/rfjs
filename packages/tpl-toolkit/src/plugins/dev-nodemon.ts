import { spawn } from 'node:child_process';

let nodemonProcess: ReturnType<typeof spawn> | null = null;

export type DevNodemonPluginOptions = {
  entry?: string;
};

type TsdownPlugin = {
  name: string;
  buildStart: (options: Record<string, unknown>) => void;
  writeBundle: () => void;
};

function devNodemonFn(entry: string): void {
  if (nodemonProcess) {
    return;
  }

  const nodemonArgs = ['--ext', 'js', '--exec', `"node ${entry}"`];

  nodemonProcess = spawn('npx', ['nodemon', ...nodemonArgs], {
    stdio: 'inherit',
    shell: true,
  });

  nodemonProcess.on('close', (code: number) => {
    console.log(`nodemon exited with code ${code}`);
    nodemonProcess = null;
  });
}

/**
 * Tsdown plugin that spawns nodemon in watch mode for dev.
 */
export function tsdownDevNodemonPlugin(
  opts: DevNodemonPluginOptions = {},
): TsdownPlugin {
  const entry: string = opts.entry ?? 'dist/main.js';
  let started: boolean = false;
  let watchMode: boolean = false;

  return {
    name: 'tsdown-dev-nodemon-plugin',
    buildStart(options: Record<string, unknown>): void {
      watchMode = Boolean(options.watch);
      const meta = options.meta as Record<string, unknown> | undefined;
      watchMode = Boolean(meta?.watchMode) || watchMode;
    },
    writeBundle(): void {
      if (watchMode && !started) {
        started = true;
        console.log('Starting nodemon...');
        devNodemonFn(entry);
        started = false;
        console.log('Nodemon started successfully');
      }
    },
  };
}
