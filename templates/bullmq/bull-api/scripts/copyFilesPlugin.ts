/* eslint-disable @typescript-eslint/require-await */

// copyFilesPlugin.js
import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';

const copyFilesFn = async (distDir: string, paths: string[]) => {
  paths = paths || [];
  console.log(`\nCopying ${paths.join(', ')} to: ${distDir}`);

  for (const p of paths) {
    const srcPath = path.resolve(p);
    const destPath = path.join(distDir, p);

    try {
      fs.accessSync(srcPath, fs.constants.R_OK);
    } catch {
      console.error(`\nPath not found: ${srcPath}`);
      continue;
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    fs.cpSync(srcPath, destPath, {
      recursive: true, // ⭐ 關鍵
      force: true, // 覆蓋
      preserveTimestamps: true,
    });

    console.log(`\nCopied: ${srcPath} → ${destPath}`);
  }
};

type CopyFilesPluginOptions = {
  distDir?: string;
  files?: string[];
};

export function copyFilesEsbuildPlugin(options: CopyFilesPluginOptions) {
  const { distDir, files } = options;
  const name = 'copy-files-plugin';
  return {
    name: name,
    setup(build: esbuild.PluginBuild) {
      build.onEnd(() => copyFilesFn(distDir ?? 'dist', files ?? []));
    },
  };
}
