/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { defineConfig } from 'tsdown';
import { tsdownCopyPackageJsonPlugin } from './scripts/copyPackageJsonPlugin';
import fs from 'fs';

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

  treeshake: true,

  //
  platform: 'neutral',
  // or
  // platform: 'node',

  fixedExtension: false,

  // 你原本沒設 target，就給個合理的預設
  target: 'es2023',

  // sourcemap: true 跟 esbuild 行為一致
  sourcemap: true,

  // 清 dist（如果還是習慣自己跑 clean script，可以把這行拿掉）
  clean: true,

  // .d.ts 生成：
  // - 若 package.json 有 "types" 或 exports.types，預設會自動開啟 dts
  // - 為了明確，這邊直接打開
  dts: {
    // 使用 Oxc backend，速度比較快（需要 tsconfig 裡有 isolatedDeclarations 會更爽）:contentReference[oaicite:1]{index=1}
    oxc: true,
  },
  plugins: [
    tsdownCopyPackageJsonPlugin({
      distDir: 'dist',
    }),
  ],
});
