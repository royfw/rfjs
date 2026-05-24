import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Docs VitePress',
  base: process.env.VITEPRESS_BASE || '/',
  description: 'test deploy VitePress page',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'CHANGELOG', link: '/CHANGELOG' },
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Test Report', link: '/lcov-report/', target: '_self' },
          { text: 'Code Coverage Report', link: '/test-results/jest/', target: '_self' },
        ],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/vuejs/vitepress' }],
  },
});
