/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { defineConfig } from 'tsdown';
import { tsdownCopyPackageJsonPlugin } from './scripts/copyPackageJsonPlugin';
import fs from 'fs';
import { copyFilesPlugin } from './scripts/copyFilesPlugin';

// 讀取 root package.json，標記 external
const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

export default defineConfig({
  // 對應你原本的 inputFile = 'src/index.ts'
  entry: 'src/index.ts',

  // 對應原本 distDir = 'dist'
  outDir: 'dist',
  external: externalDeps,

  tsconfig: 'tsconfig.build.json',

  // 一次出 ESM + CJS（取代你原本兩個 esbuild.build）
  format: ['esm', 'cjs'],

  fixedExtension: false,

  treeshake: true,

  // 對應原本 platform: 'neutral'
  platform: 'node',

  // 你原本沒設 target，就給個合理的預設
  target: 'es2023',

  // sourcemap: true 跟 esbuild 行為一致
  sourcemap: true,

  // 清 dist（如果還是習慣自己跑 clean script，可以把這行拿掉）
  clean: true,

  // .d.ts 生成：
  plugins: [
    tsdownCopyPackageJsonPlugin({
      distDir: 'dist',
    }),
    copyFilesPlugin({
      files: ['prisma', 'prisma.config.ts'],
    }),
  ],
});
