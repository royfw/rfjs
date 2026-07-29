/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// copyPackageJsonPlugin.js
import fs from 'fs';
import path from 'path';

// `dist/` 在發佈時成為套件根目錄，所以要把指向 `dist/…` 的路徑
// 重寫成相對於 dist 根（例如 `./dist/schema.mjs` → `./schema.mjs`）。
const stripDistPrefix = (p: string): string => p.replace(/^\.?\/?dist\//, './');

// 遞迴改寫 exports map（含 import/require/types 巢狀條件與陣列 fallback），
// 保留深層子路徑（如 `./schema`），只把 dist 前綴拿掉——不要整包刪掉，
// 否則真的發佈到 registry 後深層匯入會壞掉。
const rewriteExports = (value: any): any => {
  if (typeof value === 'string') return stripDistPrefix(value);
  if (Array.isArray(value)) return value.map(rewriteExports);
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [key, v] of Object.entries(value)) out[key] = rewriteExports(v);
    return out;
  }
  return value;
};

// eslint-disable-next-line @typescript-eslint/require-await
const copyPackageJsonFn = async (distDir: string) => {
  // 1) 讀取根目錄的 package.json
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  // 2) 根據需求刪除或改寫欄位
  //    例如刪除 devDependencies、scripts 等
  delete pkg.main;
  delete pkg.module;
  delete pkg.types;
  delete pkg.devDependencies;
  delete pkg.scripts;
  delete pkg['lint-staged'];
  delete pkg.config;
  delete pkg.packageManager;

  // 3) 如果要指定新的 main/module/types
  //    （通常你會在 dist 內成為新的根）
  pkg.main = 'index.js';
  pkg.module = 'index.mjs';
  pkg.types = 'index.d.ts';

  // 4) 保留並改寫 exports（含深層路徑），使其發佈到 registry 後仍可用
  if (pkg.exports) {
    pkg.exports = rewriteExports(pkg.exports);
  }

  // 5) 寫回 distDir 中
  const outPath = path.join(distDir, 'package.json');
  fs.writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf-8');
  console.log(`\nPackage.json copied to: ${outPath}`);
};

export function copyPackageJsonPlugin(
  options = {
    distDir: 'dist',
    type: 'tsdown',
  },
) {
  const { distDir, type } = options;
  const name = `${type}-copy-package-json-plugin`;
  switch (type) {
    case 'rollup':
      return {
        name: name,
        writeBundle() {
          copyPackageJsonFn(distDir);
        },
      };
    case 'esbuild':
      return {
        name: name,
        setup(build: any) {
          build.onEnd(() => copyPackageJsonFn(distDir));
        },
      };
    case 'tsdown':
      return {
        name,
        async closeBundle() {
          await copyPackageJsonFn(distDir);
        },
      };
    default:
      return copyPackageJsonFn(distDir);
  }
}

export const esbuildCopyPackageJsonPlugin = (options: any) =>
  copyPackageJsonPlugin({
    ...options,
    type: 'esbuild',
  });

export const rollupCopyPackageJsonPlugin = (options: any) =>
  copyPackageJsonPlugin({
    ...options,
    type: 'rollup',
  });

export const tsdownCopyPackageJsonPlugin = (options: any) =>
  copyPackageJsonPlugin({
    ...options,
    type: 'tsdown',
  });
