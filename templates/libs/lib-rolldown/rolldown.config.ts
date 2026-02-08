/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import path from 'path';
import fs from 'fs';

import typescript from 'rollup-plugin-typescript2';
import { dts } from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import { defineConfig } from 'rolldown';
import { rollupCopyPackageJsonPlugin } from './scripts/copyPackageJsonPlugin';

const distDir = 'dist';
const inputFile = 'src/index.ts';

// 讀取 root package.json，標記 external
const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

export default defineConfig([
  {
    input: inputFile,
    output: [
      {
        // file: path.join(distDir, 'index.mjs'),
        dir: distDir,
        format: 'esm',
        sourcemap: true,
        inlineDynamicImports: true,
        entryFileNames: '[name].mjs',
      },
      {
        // file: path.join(distDir, 'index.js'),
        dir: distDir,
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: true,
        entryFileNames: '[name].js',
      },
    ],
    external: externalDeps,
    plugins: [
      typescript({
        tsconfig: 'tsconfig.build.json',
        useTsconfigDeclarationDir: true,
      }),

      // (選擇性) copy 其他檔案到 dist
      copy({
        targets: [
          { src: 'README.md', dest: distDir },
          // 若要 copy .npmrc、LICENSE 等檔案也可在這裡加
        ],
        hook: 'writeBundle',
      }),

      rollupCopyPackageJsonPlugin({ distDir }),
    ],
  },
  // ----- (2) DTS 构建：合併型別檔為 index.d.ts -----
  {
    input: path.join('types/index.d.ts'),
    output: {
      file: path.join(distDir, 'index.d.ts'),
      format: 'es',
    },
    plugins: [dts()],
    external: externalDeps,
  },
]);
