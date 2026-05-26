import fs from 'fs';
import path from 'path';

export type CopyFilesPluginOptions = {
  distDir?: string;
  files?: string[];
};

/**
 * Copy files/directories into the dist output folder.
 * Used as a tsdown (Rspack) plugin via closeBundle hook.
 */
export async function copyFilesFn(distDir: string, filePaths: string[]): Promise<void> {
  filePaths = filePaths || [];
  console.log(`\nCopying ${filePaths.join(', ')} to: ${distDir}`);

  for (const p of filePaths) {
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
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
    console.log(`\nCopied: ${srcPath} → ${destPath}`);
  }
}

/**
 * Tsdown/Rspack plugin that copies files after bundling.
 */
export function copyFilesPlugin(options: CopyFilesPluginOptions = {}) {
  const { distDir = 'dist', files = [] } = options;
  return {
    name: 'copy-files-plugin',
    async closeBundle(): Promise<void> {
      await copyFilesFn(distDir, files);
    },
  };
}
