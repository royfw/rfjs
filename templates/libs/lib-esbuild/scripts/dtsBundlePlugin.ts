/* eslint-disable @typescript-eslint/require-await */
import { generateDtsBundle } from 'dts-bundle-generator';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import esbuild from 'esbuild';

type DtsBundlePluginType = {
  type?: string;
  entry?: string;
  outFile?: string;
  preferredConfigPath?: string;
};

export function dtsBundlePlugin(options: DtsBundlePluginType = {}) {
  const {
    type,
    entry = './types/index.d.ts', // TS原始碼入口(或已產生的.d.ts) // './src/index.ts'
    outFile = './dist/index.d.ts', // 輸出合併後的檔案
    preferredConfigPath = './tsconfig.build.json', // 若你有自訂 tsconfig.json 路徑
  } = options;
  const name = type ? `${type}-dts-bundle-plugin` : 'dts-bundle-plugin';
  const dtsBundleGenerator = async () => {
    try {
      execSync(`tsc --noEmit --skipLibCheck`, {
        stdio: 'inherit',
      });
      console.log(`[${name}] TypeScript check passed.`);
      execSync(`tsc -p ./tsconfig.build.json --emitDeclarationOnly`, {
        stdio: 'inherit',
      });
      console.log(`[${name}] TypeScript emitDeclarationOnly.`);

      // 調用 dts-bundle-generator
      const [generatedDts] = generateDtsBundle(
        [
          {
            filePath: entry,
          },
        ],
        {
          preferredConfigPath, // 例如 './tsconfig.json'
          // 也可以設定輸出風格, banner, sortNodes, 等等
        },
      );

      // 確保 dist 資料夾存在
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      // 寫入檔案
      fs.writeFileSync(outFile, generatedDts, 'utf-8');

      console.log(`[${name}] Wrote d.ts to: ${outFile}`);
    } catch (err) {
      console.error(`[${name}] Failed to generate d.ts:`, err);
    }
  };
  return {
    name,
    setup(build: esbuild.PluginBuild) {
      console.log(`[dts-bundle-plugin] Generating d.ts from: ${entry}`);
      build.onEnd(() => dtsBundleGenerator());
    },
  };
}
