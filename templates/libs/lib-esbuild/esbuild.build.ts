/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import esbuild from 'esbuild';
import { copyPackageJsonPlugin } from './scripts/copyPackageJsonPlugin';
import { dtsBundlePlugin } from './scripts/dtsBundlePlugin';
import path from 'path';
import fs from 'fs';
import esbuildPluginTsc from 'esbuild-plugin-tsc';
import { copyFilesEsbuildPlugin } from './scripts/copyFilesPlugin';

const distDir = 'dist';
const inputFile = 'src/index.ts';

// 讀取 root package.json，標記 external
const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

const sharedConfig: esbuild.SameShape<esbuild.BuildOptions, esbuild.BuildOptions> = {
  entryPoints: [inputFile],
  bundle: true,
  platform: 'neutral', // library 通常 neutral, 或 browser/node 看需求
  sourcemap: true, // 是否需要 sourcemap
  external: externalDeps, // 不要把相依套件打包進來
  tsconfig: './tsconfig.build.json', // 使用 tsconfig.json 設定
  // minify: true,       // 需壓縮可開啟
  // external: ['lodash','react'], // 若有外部依賴不想打進lib可外部化
  plugins: [esbuildPluginTsc()],
};

async function buildLib() {
  // 1) ESM 輸出
  await esbuild.build({
    ...sharedConfig,
    outfile: path.join(distDir, 'index.mjs'),
    format: 'esm',
    // target: ['es2020'],
    plugins: [
      // esbuildCopyPackageJsonPlugin({ distDir }),
    ],
  });

  // 2) CJS 輸出
  await esbuild.build({
    ...sharedConfig,
    outfile: path.join(distDir, 'index.js'),
    format: 'cjs',
    // target: ['node14'],
  });

  // 3) DTS 輸出
  dtsBundlePlugin();

  // 4) 複製 package.json
  copyPackageJsonPlugin({
    distDir,
  });

  copyFilesEsbuildPlugin({
    files: ['README.md'],
  });
}

buildLib().catch(() => process.exit(1));
