# docs-docsify Documentation

A lightweight documentation site template powered by Docsify - the magical documentation site generator that works entirely in the browser.

## Overview

This template provides a complete foundation for creating beautiful documentation websites using:

- **Docsify** - Client-side documentation site generator
- **Zero Build** - No static site generation, runs directly in browser
- **Markdown** - Write docs in simple Markdown format
- **esbuild/Rollup** - Optional build tools for custom scripts
- **Jest/Testing** - Optional testing infrastructure

## Features

### Core Features

- 📝 **Zero Build Required**
  - No static site generation
  - No build step for documentation
  - Instant preview and deployment

- 🎨 **Beautiful Out of the Box**
  - Multiple built-in themes
  - Responsive design
  - Customizable styling

- 🔍 **Full-text Search**
  - Built-in search plugin
  - No server required
  - Works offline

- 🌐 **Multi-language Support**
  - Easy i18n setup
  - Language switching
  - Localized navigation

- 🔌 **Rich Plugin Ecosystem**
  - Syntax highlighting
  - Emoji support
  - Copy code button
  - And many more

- 📱 **Mobile Friendly**
  - Responsive layout
  - Touch-friendly navigation
  - PWA ready

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm 10.24.0 or higher (for custom scripts)

### Installation

```bash
# Clone or copy the template
cd docs-docsify

# Install dependencies (if using custom scripts)
pnpm install
```

### Development

#### Option 1: Simple Static Server

```bash
# Using any static server
npx serve docs

# Or using Python
python -m http.server 3000 --directory docs

# Or using PHP
php -S localhost:3000 -t docs
```

#### Option 2: With Build Tools

```bash
# Start development server
pnpm dev

# The documentation will be available at http://localhost:3000
```

### Deployment

Docsify sites can be deployed to any static hosting service:

```bash
# The docs/ directory contains all you need to deploy
# Just upload it to your hosting service
```

## Project Structure

```
docs-docsify/
├── docs/                      # Documentation source
│   ├── index.html            # Docsify entry point
│   ├── README.md             # Homepage content
│   ├── .nojekyll             # Prevent Jekyll processing
│   ├── _sidebar.md           # Sidebar navigation (optional)
│   ├── _navbar.md            # Top navbar (optional)
│   ├── _coverpage.md         # Cover page (optional)
│   └── guide/                # Documentation sections
│       ├── quickstart.md
│       └── ...
├── src/                      # Custom scripts (optional)
│   └── main.ts
└── package.json              # Build tools config (optional)
```

## Configuration

### Basic Configuration

Edit `docs/index.html` to configure Docsify:

```html
<script>
  window.$docsify = {
    name: 'Your Project',
    repo: 'your-username/your-repo',
    loadSidebar: true,
    subMaxLevel: 2,
    search: {
      placeholder: 'Search...',
      noData: 'No results found'
    }
  }
</script>
```

### Common Options

```javascript
window.$docsify = {
  // Project name
  name: 'docs-docsify',
  
  // GitHub repo
  repo: 'your-username/docs-docsify',
  
  // Sidebar
  loadSidebar: true,
  subMaxLevel: 3,
  
  // Navbar
  loadNavbar: true,
  
  // Cover page
  coverpage: true,
  
  // Search
  search: {
    placeholder: 'Type to search',
    noData: 'No results!',
    depth: 6
  },
  
  // Theme
  themeColor: '#3F51B5',
  
  // Auto header
  auto2top: true
}
```

## Writing Documentation

### Creating Pages

Create Markdown files in the `docs/` directory:

```markdown
# Page Title

Your content here...

## Section

More content...
```

### Sidebar Navigation

Create `docs/_sidebar.md`:

```markdown
* [Home](/)
* [Guide](guide/)
  * [Quick Start](guide/quickstart.md)
  * [Configuration](guide/configuration.md)
* [API](api/)
  * [Methods](api/methods.md)
```

### Top Navigation

Create `docs/_navbar.md`:

```markdown
* [English](/)
* [中文](/zh-cn/)

* Getting Started
  * [Quick Start](quickstart.md)
  * [Writing More Pages](more-pages.md)
```

### Cover Page

Create `docs/_coverpage.md`:

```markdown
![logo](_media/icon.svg)

# My Docs

> An awesome documentation site.

* Simple and lightweight
* No build process
* Multiple themes

[GitHub](https://github.com/your-repo/)
[Get Started](#introduction)
```

## Plugins

### Essential Plugins

Already included in the template:

```html
<!-- Search -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/search.min.js"></script>

<!-- Emoji -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/emoji.min.js"></script>

<!-- Copy Code -->
<script src="//cdn.jsdelivr.net/npm/docsify-copy-code"></script>

<!-- Syntax Highlighting -->
<script src="//cdn.jsdelivr.net/npm/prismjs/components/prism-bash.min.js"></script>
<script src="//cdn.jsdelivr.net/npm/prismjs/components/prism-typescript.min.js"></script>
```

### Additional Plugins

Add more plugins by including scripts in `index.html`:

```html
<!-- Pagination -->
<script src="//cdn.jsdelivr.net/npm/docsify-pagination/dist/docsify-pagination.min.js"></script>

<!-- Tabs -->
<script src="//cdn.jsdelivr.net/npm/docsify-tabs@1"></script>

<!-- Zoom Image -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/zoom-image.min.js"></script>
```

## Themes

### Built-in Themes

Change theme by modifying the CSS link in `index.html`:

```html
<!-- Vue theme (default) -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/vue.css">

<!-- Dark theme -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/dark.css">

<!-- Buble theme -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/buble.css">

<!-- Pure theme -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/npm/docsify/lib/themes/pure.css">
```

### Custom Styling

Add custom CSS in `index.html`:

```html
<style>
  :root {
    --theme-color: #3F51B5;
    --base-font-size: 16px;
  }
</style>
```

## Custom Scripts

### Using TypeScript

If you need custom scripts, the template includes build tools:

```typescript
// src/main.ts
export function initCustomFeatures() {
  // Your custom logic
}

// Call from docs/index.html
window.initCustomFeatures();
```

### Build Configuration

```bash
# Development build
pnpm dev:esbuild   # or dev:rollup

# Production build
pnpm build
```

## Testing

### Unit Tests

```bash
# Run tests
pnpm test

# Watch mode
pnpm jest:watch

# Coverage
pnpm jest:cov
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# With coverage
pnpm jest:e2e:cov
```

## Deployment

### GitHub Pages

1. Push your code to GitHub
2. Go to repository Settings → Pages
3. Select source: main branch / docs folder
4. Your site will be available at `https://username.github.io/repo-name/`

### Netlify

1. Connect your repository to Netlify
2. Build settings:
   - Build command: (leave empty or use custom build)
   - Publish directory: `docs`
3. Deploy

### Vercel

1. Import your repository
2. Framework preset: Other
3. Root directory: `docs`
4. Deploy

### Docker

```dockerfile
FROM nginx:alpine
COPY docs /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
# Build and run
docker build -t my-docs .
docker run -p 8080:80 my-docs
```

## Development Scripts

```bash
# Development
pnpm dev               # Start with default builder
pnpm dev:esbuild      # esbuild watch mode
pnpm dev:rollup       # Rollup watch mode
pnpm start            # Run built application

# Building
pnpm build            # Production build
pnpm build:esbuild    # Build with esbuild
pnpm build:rollup     # Build with Rollup
pnpm clean            # Clean dist directory

# Testing
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm jest             # Jest in watch mode
pnpm jest:cov         # Coverage report

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues

# Release
pnpm release          # Create release
```

## Best Practices

1. **Documentation Organization**
   - Keep related pages in subdirectories
   - Use clear, descriptive filenames
   - Maintain a logical hierarchy

2. **Markdown Style**
   - Use consistent heading levels
   - Include code examples
   - Add links between related pages

3. **Navigation**
   - Keep sidebar organized
   - Use nested navigation for complex docs
   - Add breadcrumbs for deep hierarchies

4. **Performance**
   - Optimize images
   - Use CDN for assets
   - Enable caching

5. **SEO**
   - Use descriptive page titles
   - Add meta descriptions
   - Include keywords naturally

## Tech Stack

- **Framework**: Docsify (client-side)
- **Language**: TypeScript 5.7+ (for custom scripts)
- **Build Tools**: esbuild 0.25+ / Rollup 4.36+ (optional)
- **Testing**: Jest 29.7+ (optional)
- **Package Manager**: pnpm 10.24+ (optional)

## Troubleshooting

### Common Issues

**Sidebar not showing**
```javascript
// Ensure loadSidebar is enabled
window.$docsify = {
  loadSidebar: true
}
```

**Search not working**
```html
<!-- Ensure search plugin is included -->
<script src="//cdn.jsdelivr.net/npm/docsify/lib/plugins/search.min.js"></script>
```

**404 on GitHub Pages**
```
# Ensure .nojekyll file exists in docs/
touch docs/.nojekyll
```

## Additional Resources

- [Docsify Documentation](https://docsify.js.org/)
- [Docsify Plugins](https://docsify.js.org/#/plugins)
- [Awesome Docsify](https://github.com/docsifyjs/awesome-docsify)
- [Markdown Guide](https://www.markdownguide.org/)

## License

ISC

---

**Part of** [rfjs/templates](https://github.com/royfw/rfjs)