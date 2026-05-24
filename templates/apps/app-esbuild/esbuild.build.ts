// esbuild.build.js
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { copyFilesEsbuildPlugin } from './scripts/copyFilesPlugin';

const distDir = 'dist';
const inputFile = 'src/main.ts';

// 讀取 root package.json，標記 external
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg: Record<string, unknown> = JSON.parse(
  fs.readFileSync('./package.json', 'utf-8'),
);
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

const sharedConfig: esbuild.SameShape<esbuild.BuildOptions, esbuild.BuildOptions> = {
  entryPoints: [inputFile],
  bundle: true,
  platform: 'node', // library 通常 neutral, 或 browser/node 看需求
  sourcemap: true, // 是否需要 sourcemap
  external: externalDeps, // 不要把相依套件打包進來
  tsconfig: './tsconfig.build.json', // 使用 tsconfig.json 設定
  // minify: true,       // 需壓縮可開啟
};

async function buildApp() {
  // 1) ESM / CJS 輸出
  await esbuild.build({
    ...sharedConfig,
    outfile: path.join(distDir, 'main.js'),
    format: 'cjs',
    target: ['es2023'],
    plugins: [
      esbuildPluginTsc(),
      copyFilesEsbuildPlugin({
        files: ['README.md'],
      }),
    ],
  });
}

buildApp().catch(() => process.exit(1));
