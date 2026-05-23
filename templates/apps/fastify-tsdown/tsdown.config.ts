/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { defineConfig } from 'tsdown';
import fs from 'fs';
import { copyFilesPlugin } from './scripts/copyFilesPlugin';
import { tsdownDevNodemonPlugin } from './scripts/devNodemonPlugin';

// 讀取 root package.json，標記 external
const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

const copyFiles = (JSON.parse(fs.readFileSync('./copyFiles.json', 'utf-8')) ??
  []) as string[];

export default defineConfig({
  entry: 'src/main.ts',

  // 對應原本 distDir = 'dist'
  outDir: 'dist',
  external: externalDeps,

  tsconfig: 'tsconfig.build.json',

  format: ['cjs'],

  treeshake: true,

  platform: 'node',

  fixedExtension: false,

  // 你原本沒設 target，就給個合理的預設
  target: 'es2023',

  // sourcemap: true 跟 esbuild 行為一致
  sourcemap: true,

  // 清 dist（如果還是習慣自己跑 clean script，可以把這行拿掉）
  clean: true,

  plugins: [
    copyFilesPlugin({
      distDir: 'dist',
      files: copyFiles,
    }),
    tsdownDevNodemonPlugin(),
  ],
});
