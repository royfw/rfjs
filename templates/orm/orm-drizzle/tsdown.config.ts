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
  // 多入口：root barrel + 深層 `./schema` 子路徑（object 形式可鎖定輸出檔名）
  // → dist/index.* 與 dist/schema.*，對應 package.json 的 exports 深層路徑
  entry: {
    index: 'src/index.ts',
    schema: 'src/schema/index.ts',
  },

  // 對應原本 distDir = 'dist'
  outDir: 'dist',
  external: externalDeps,

  tsconfig: 'tsconfig.build.json',

  // 一次出 ESM + CJS（取代你原本兩個 esbuild.build）
  format: ['esm', 'cjs'],

  treeshake: true,

  // 對應原本 platform: 'neutral'
  platform: 'node',

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
    // 必須關閉 oxc：oxc 的 dts backend 是 isolatedDeclarations 產生器，不做型別推斷，
    // 遇到 `export const usersTable = pgTable(...)` 會直接報
    // TS9010 (Variable must have an explicit type annotation)。
    // drizzle 的 pgTable 回傳型別是巨大的泛型 PgTableWithColumns<...>，無法手寫標注，
    // 因此改用 TypeScript backend 讓它自己推斷。（tsdown 0.22.14 實測仍是如此）
    oxc: false,
  },
  plugins: [
    tsdownCopyPackageJsonPlugin({
      distDir: 'dist',
    }),
    copyFilesPlugin({
      files: ['drizzle'],
    }),
  ],
});
