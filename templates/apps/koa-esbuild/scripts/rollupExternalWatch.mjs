import fg from 'fast-glob';

const { Options: FastOptions } = fg;

/**
 * Rollup external watch function
 * @param { FastOptions } options
 */
export const rollupExternalWatch = (
  opt = {
    sources: ['src/**/*'],
    options: {
      absolute: true,
    },
  },
) => {
  const { sources, options } = opt;
  return {
    name: 'rollup-external-watch',
    async buildStart() {
      // 確保在 watch 模式下，重新編譯時不會觸發
      if (this.meta.watchMode) {
        return;
      }

      // 使用 fast-glob 來獲取所有的源文件
      const files = await fg(sources, options);

      // 如果沒有找到任何文件，則不需要進行後續處理
      if (files.length === 0) {
        console.warn('No source files found for rollup external watch.');
        return;
      }

      // 將找到的文件添加到 Rollup 的外部依賴中
      this.addWatchFile(files);
    },
  };
};
