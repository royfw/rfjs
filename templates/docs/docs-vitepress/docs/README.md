# docs-vitepress Documentation

A powerful documentation site template built with VitePress - the Vue-powered static site generator optimized for writing technical documentation.

## Overview

This template provides a complete foundation for creating modern documentation websites using:

- **VitePress** - Vue-powered static site generator
- **Vite** - Next-generation frontend tooling
- **Vue 3** - Progressive JavaScript framework
- **Markdown** - Extended Markdown with Vue components
- **TypeScript** - Type-safe development

## Features

### Core Features

- ⚡ **Lightning Fast**
  - Instant server start with Vite
  - Hot Module Replacement (HMR)
  - Optimized production builds

- 🎨 **Beautiful Design**
  - Modern, clean UI
  - Dark mode support
  - Customizable theme colors
  - Responsive layout

- 🔍 **Powerful Search**
  - Built-in local search
  - No server or external dependencies
  - Instant search results

- 📝 **Markdown Enhanced**
  - GitHub-flavored Markdown
  - Code syntax highlighting
  - Custom containers
  - Emoji support
  - Table of contents

- 🌐 **Internationalization**
  - First-class i18n support
  - Language switching
  - Localized navigation

- 🎯 **Type-Safe**
  - Full TypeScript support
  - Type-safe configuration
  - IntelliSense support

- 🚀 **Production Ready**
  - Static site generation (SSG)
  - SEO optimized
  - Fast page loads
  - Automatic code splitting

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm 10.24.0 or higher

### Installation

```bash
# Clone or copy the template
cd docs-vitepress

# Install dependencies
pnpm install
```

### Development

```bash
# Start VitePress dev server
pnpm docs:dev

# The documentation will be available at http://localhost:5173
```

### Building

```bash
# Build for production
pnpm docs:build

# Output will be in docs/.vitepress/dist
```

### Preview Production Build

```bash
# Preview the built site
pnpm docs:preview
```

## Project Structure

```
docs-vitepress/
├── docs/
│   ├── .vitepress/              # VitePress configuration
│   │   ├── config.ts           # Site configuration
│   │   ├── theme/              # Custom theme
│   │   │   ├── index.ts        # Theme entry
│   │   │   └── style.css       # Custom styles
│   │   └── dist/               # Built output
│   ├── public/                 # Static assets
│   ├── index.md                # Homepage
│   ├── guide/                  # Guide section
│   │   ├── index.md
│   │   └── getting-started.md
│   └── api/                    # API reference
│       └── index.md
├── src/                        # Custom scripts (optional)
└── package.json
```

## Configuration

### Site Configuration

Edit `docs/.vitepress/config.ts`:

```typescript
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'My Documentation',
  description: 'My awesome documentation site',
  
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' }
    ],
    
    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        }
      ]
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-repo' }
    ]
  }
});
```

### Theme Customization

Customize colors in `docs/.vitepress/theme/style.css`:

```css
:root {
  --vp-c-brand: #3F51B5;
  --vp-c-brand-light: #5C6BC0;
  --vp-c-brand-lighter: #9FA8DA;
  --vp-c-brand-dark: #303F9F;
  --vp-c-brand-darker: #283593;
}
```

### Custom Theme Components

Extend the default theme in `docs/.vitepress/theme/index.ts`:

```typescript
import DefaultTheme from 'vitepress/theme';
import './style.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Register custom components
  }
};
```

## Writing Documentation

### Frontmatter

Add metadata to your Markdown files:

```markdown
---
title: Getting Started
description: Learn how to get started
layout: doc
---

# Getting Started

Your content here...
```

### Custom Containers

Use built-in containers:

```markdown
::: info
This is an info box.
:::

::: tip
This is a tip.
:::

::: warning
This is a warning.
:::

::: danger
This is a dangerous warning.
:::

::: details Click to see details
This is a details block.
:::
```

### Code Blocks

Enhanced code blocks with syntax highlighting:

````markdown
```typescript{1,3-5}
// Line 1 is highlighted
const greeting = 'Hello';
// Lines 3-5 are highlighted
function greet(name: string) {
  return `${greeting}, ${name}!`;
}
```
````

### Code Groups

Create tabbed code blocks:

````markdown
::: code-group
```typescript [TypeScript]
const greeting: string = 'Hello';
```

```javascript [JavaScript]
const greeting = 'Hello';
```
:::
````

### Using Vue Components

Import and use Vue components in Markdown:

```markdown
<script setup>
import CustomComponent from './components/CustomComponent.vue';
</script>

# My Page

<CustomComponent />
```

### Table of Contents

Automatically generate TOC:

```markdown
[[toc]]
```

## Navigation

### Sidebar Configuration

Configure sidebar in `config.ts`:

```typescript
sidebar: {
  '/guide/': [
    {
      text: 'Guide',
      items: [
        { text: 'Introduction', link: '/guide/' },
        { text: 'Getting Started', link: '/guide/getting-started' }
      ]
    },
    {
      text: 'Advanced',
      items: [
        { text: 'Configuration', link: '/guide/configuration' }
      ]
    }
  ]
}
```

### Navigation Bar

Configure navbar in `config.ts`:

```typescript
nav: [
  { text: 'Home', link: '/' },
  { text: 'Guide', link: '/guide/' },
  {
    text: 'Dropdown',
    items: [
      { text: 'Item A', link: '/item-a' },
      { text: 'Item B', link: '/item-b' }
    ]
  }
]
```

## Internationalization

### i18n Configuration

Configure multiple languages:

```typescript
export default defineConfig({
  locales: {
    root: {
      label: 'English',
      lang: 'en'
    },
    'zh-TW': {
      label: '繁體中文',
      lang: 'zh-TW',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh-TW/guide/' }
        ]
      }
    }
  }
});
```

### Localized Content

Create localized directories:

```
docs/
├── index.md              # English homepage
├── guide/
│   └── index.md
└── zh-TW/
    ├── index.md          # Chinese homepage
    └── guide/
        └── index.md
```

## Custom Scripts

### Using TypeScript

If you need custom scripts, the template includes build tools:

```typescript
// src/main.ts
export function initCustomFeatures() {
  // Your custom logic
}
```

### Build Configuration

```bash
# Development build
pnpm dev

# Production build
pnpm build
```

## Testing

### Unit Tests

```bash
# Run tests
pnpm test

# With Vitest
pnpm vitest:run

# With Jest
pnpm jest
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# With coverage
pnpm vitest:e2e:run
```

## Deployment

### GitHub Pages

1. Configure base in `config.ts`:
```typescript
export default defineConfig({
  base: '/your-repo-name/'
});
```

2. Build and deploy:
```bash
pnpm docs:build
# Upload docs/.vitepress/dist to GitHub Pages
```

### Netlify

1. Build settings:
   - Build command: `pnpm docs:build`
   - Publish directory: `docs/.vitepress/dist`

2. Deploy

### Vercel

1. Import repository
2. Framework preset: VitePress
3. Build command: `pnpm docs:build`
4. Output directory: `docs/.vitepress/dist`

### Docker

```dockerfile
# Build stage
FROM node:18-alpine as builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm docs:build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/docs/.vitepress/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Development Scripts

```bash
# Documentation
pnpm docs:dev         # Start VitePress dev server
pnpm docs:build       # Build documentation
pnpm docs:preview     # Preview production build

# Development (custom scripts)
pnpm dev              # Start with esbuild
pnpm dev:rollup       # Rollup watch mode
pnpm build            # Production build
pnpm clean            # Clean dist directory

# Testing
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm vitest           # Vitest watch mode
pnpm vitest:ui        # Vitest UI
pnpm jest             # Jest watch mode

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues

# Release
pnpm release          # Create release
```

## Best Practices

1. **Content Organization**
   - Group related content in directories
   - Use clear, descriptive filenames
   - Maintain consistent structure

2. **Markdown Style**
   - Use frontmatter for metadata
   - Leverage custom containers
   - Include code examples
   - Add internal links

3. **Performance**
   - Optimize images
   - Use lazy loading for heavy components
   - Enable caching

4. **SEO**
   - Add meaningful titles and descriptions
   - Use proper heading hierarchy
   - Include meta tags

5. **Accessibility**
   - Use semantic HTML
   - Provide alt text for images
   - Ensure keyboard navigation

## Tech Stack

- **Framework**: VitePress 1.6+
- **Build Tool**: Vite (Rollup + esbuild)
- **Language**: TypeScript 5.7+
- **UI Framework**: Vue 3
- **Testing**: Vitest 3.2+ / Jest 29.7+
- **Package Manager**: pnpm 10.24+

## Troubleshooting

### Common Issues

**Port already in use**
```bash
# Change port in docs:dev script
vitepress dev docs --port 5174
```

**Build fails**
```bash
# Clean and rebuild
rm -rf docs/.vitepress/dist
pnpm docs:build
```

**Images not loading**
```
# Place images in docs/public/
# Reference as /image.png in Markdown
```

## Additional Resources

- [VitePress Documentation](https://vitepress.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Markdown Guide](https://www.markdownguide.org/)

## License

ISC

---

**Part of** [rfjs/templates](https://github.com/royfw/rfjs)