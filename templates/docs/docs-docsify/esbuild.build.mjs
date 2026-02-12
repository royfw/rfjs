// esbuild.build.js
import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

const distDir = 'dist';
const inputFile = 'src/main.ts';

// 讀取 root package.json，標記 external
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const externalDeps = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const sharedConfig = {
  entryPoints: [inputFile],
  bundle: true,
  platform: 'node', // library 通常 neutral, 或 browser/node 看需求
  sourcemap: true, // 是否需要 sourcemap
  // external: externalDeps, // 不要把相依套件打包進來
  tsconfig: './tsconfig.esbuild.json', // 使用 tsconfig.json 設定
  // minify: true,       // 需壓縮可開啟
};

async function buildApp() {
  // 1) ESM / CJS 輸出
  await esbuild.build({
    ...sharedConfig,
    outfile: path.join(distDir, 'main.js'),
    // format: 'esm',
    // target: ['es2020'],
    format: 'cjs',
    // target: ['node14'],
    plugins: [],
  });
}

buildApp().catch(() => process.exit(1));
