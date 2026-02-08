/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// rollup.config.js
import path from 'path';
import fs from 'fs';

import typescript from 'rollup-plugin-typescript2';
import dts from 'rollup-plugin-dts';
import copy from 'rollup-plugin-copy';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

// const projectRootDir = path.resolve(__dirname);

// 自訂 plugin: 負責 package.json 搬移與欄位調整
import { rollupCopyPackageJsonPlugin } from './scripts/copyPackageJsonPlugin';

const distDir = 'dist';
const inputFile = 'src/index.ts';

// 讀取 root package.json，標記 external
const pkg: Record<string, unknown> =
  JSON.parse(fs.readFileSync('./package.json', 'utf-8')) ?? {};
const dependencies: string[] = Object.keys(pkg.dependencies || {});
const peerDependencies: string[] = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];

export default [
  // ----- (1) JS 构建：產出 ESM + CJS -----
  {
    input: inputFile,
    output: [
      {
        file: path.join(distDir, 'index.mjs'),
        format: 'esm',
        sourcemap: true,
        inlineDynamicImports: true,
      },
      {
        file: path.join(distDir, 'index.js'),
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: true,
      },
    ],
    external: externalDeps, // 不要把相依套件打包進來
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

      resolve(),

      commonjs(),

      // 我們自訂的 plugin, build 結束後複製/修正 package.json
      rollupCopyPackageJsonPlugin({ distDir }),
    ],
  },

  // ----- (2) DTS 构建：合併型別檔為 index.d.ts -----
  {
    // input: path.join(distDir, 'types/index.d.ts'),
    input: path.join('types/index.d.ts'),
    output: {
      file: path.join(distDir, 'index.d.ts'),
      format: 'es',
    },
    plugins: [dts()],
    external: externalDeps,
  },
];
