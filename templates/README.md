# rfjs/templates

A comprehensive collection of production-ready TypeScript project templates for various use cases. Jumpstart your next project with battle-tested configurations, modern tooling, and best practices.

## 🎯 Overview

**rfjs/templates** is a curated monorepo containing 12 specialized TypeScript templates designed to accelerate your development workflow. Each template is production-ready with complete tooling, testing infrastructure, and documentation.

## ✨ Features

- 🚀 **Production Ready** - Battle-tested configurations for immediate use
- ⚡ **Modern Tooling** - esbuild, Rollup, tsdown, and more
- 🧪 **Testing Built-in** - Vitest and Jest pre-configured
- 📦 **Multiple Formats** - ESM, CJS, and optimized builds
- 🎨 **Code Quality** - ESLint, Prettier, Husky, and commitizen
- 📝 **Well Documented** - Comprehensive docs in English and 繁體中文
- 🐳 **Docker Support** - Ready for containerization
- 🌐 **Monorepo Ready** - Turborepo configuration included

## 📦 Available Templates

### Applications

#### 🚀 [app-esbuild](./apps/app-esbuild)

General-purpose TypeScript application template with esbuild for maximum build speed.

- **Use Cases**: CLI tools, backend services, Node.js apps
- **Build Tool**: esbuild
- **Testing**: Vitest

#### 🔥 [app-tsdown](./apps/app-tsdown)

Modern application template using tsdown for optimized builds.

- **Use Cases**: Production applications with minimal bundle size
- **Build Tool**: tsdown
- **Testing**: Vitest

### Backend Frameworks

#### ⚡ [fastify-esbuild](./apps/fastify-esbuild)

High-performance Fastify REST API template with automatic OpenAPI documentation.

- **Framework**: Fastify 5.6+
- **Features**: Swagger UI, validation, plugins
- **Build Tool**: esbuild

#### 🎯 [koa-esbuild](./apps/koa-esbuild)

Lightweight Koa web application with decorator-based routing and IoC.

- **Framework**: Koa 3.0+
- **Features**: routing-controllers, tsyringe DI, Swagger
- **Build Tool**: esbuild

### Libraries

#### 🧰 [lib-esbuild](./libs/lib-esbuild)

High-performance library template with esbuild for ultra-fast builds.

- **Use Cases**: npm packages, shared libraries
- **Output**: ESM + CJS
- **Build Tool**: esbuild

#### 📚 [lib-rollup](./libs/lib-rollup)

Industry-standard library template with Rollup for optimal tree-shaking.

- **Use Cases**: npm packages, shared libraries
- **Output**: ESM + CJS
- **Build Tool**: Rollup

#### 📦 [lib-tsdown](./libs/lib-tsdown)

Modern library template with tsdown for fast, optimized builds.

- **Use Cases**: npm packages with minimal footprint
- **Output**: ESM + CJS
- **Build Tool**: tsdown

#### 🔷 [lib-rolldown](./libs/lib-rolldown)

Next-generation library bundler combining Rollup and esbuild.

- **Use Cases**: High-performance libraries
- **Output**: ESM + CJS
- **Build Tool**: Rolldown

### CLI Tools

#### 🛠️ [bin-tsdown](./bins/bin-tsdown)

Command-line tool template with tsdown, perfect for creating CLI utilities.

- **Use Cases**: CLI tools, scaffolding tools
- **Features**: Commander.js integration
- **Build Tool**: tsdown

### Documentation Sites

#### 📝 [docs-docsify](./docs/docs-docsify)

Zero-build documentation site powered by Docsify.

- **Framework**: Docsify
- **Features**: Client-side rendering, no build required
- **Best For**: Quick documentation sites

#### 📖 [docs-vitepress](./docs/docs-vitepress)

Powerful documentation site with VitePress and Vue 3.

- **Framework**: VitePress 1.6+
- **Features**: SSG, Vue components, local search
- **Best For**: Technical documentation, API docs

### Monorepo

#### 🏗️ [turbo](./monorepo/turbo/stack/base)

Full-stack monorepo template with Turborepo and Next.js.

- **Framework**: Turborepo + Next.js
- **Features**: Shared packages, optimized caching
- **Best For**: Large-scale projects, microservices

## 🚀 Quick Start

### Using with start-ts-by CLI (Recommended)

```bash
# Install the CLI globally
npm install -g start-ts-by

# Create a new project from a template
start-ts-by create my-project --template app-esbuild

# Or use npx
npx start-ts-by create my-app --template fastify-esbuild
```

### Manual Clone

```bash
# Clone the repository
git clone https://github.com/royfw/rfjs.git

# Navigate to desired template
cd rfjs/templates/apps/app-esbuild

# Install dependencies
pnpm install

# Start development
pnpm dev
```

## 📖 Documentation

Each template includes comprehensive documentation:

- **README.md** - Quick start guide
- **docs/README.md** - Detailed English documentation
- **docs/README.zh-TW.md** - 繁體中文詳細文檔

For complete documentation, see:

- [Docsify English Documentation](./docs/docs-docsify/docs/README.md)
- [Docsify 繁體中文文檔](./docs/docs-docsify/docs/README.zh-TW.md)
- [VitePress English Documentation](./docs/docs-vitepress/docs/README.md)
- [VitePress 繁體中文文檔](./docs/docs-vitepress/docs/README.zh-TW.md)

## 🛠️ Template Selection Guide

| Template            | Best For                 | Build Tool | Framework |
| ------------------- | ------------------------ | ---------- | --------- |
| **app-esbuild**     | General apps, CLI tools  | esbuild    | -         |
| **app-tsdown**      | Optimized applications   | tsdown     | -         |
| **fastify-esbuild** | REST APIs, microservices | esbuild    | Fastify   |
| **koa-esbuild**     | Web apps, APIs           | esbuild    | Koa       |
| **lib-esbuild**     | npm packages             | esbuild    | -         |
| **lib-rollup**      | npm packages             | Rollup     | -         |
| **lib-tsdown**      | Minimal libraries        | tsdown     | -         |
| **lib-rolldown**    | High-perf libraries      | Rolldown   | -         |
| **bin-tsdown**      | CLI tools                | tsdown     | -         |
| **docs-docsify**    | Quick docs               | -          | Docsify   |
| **docs-vitepress**  | Technical docs           | Vite       | VitePress |
| **turbo**           | Monorepos                | Turborepo  | Next.js   |

## 🔧 Common Features

All templates include:

- ✅ **TypeScript 5.7+** - Latest TypeScript with strict mode
- 📦 **pnpm** - Fast, efficient package management
- 🧪 **Testing** - Vitest or Jest pre-configured
- 🎨 **Linting** - ESLint with TypeScript support
- 💅 **Formatting** - Prettier with sensible defaults
- 🪝 **Git Hooks** - Husky with lint-staged
- 📝 **Commitizen** - Conventional commits support
- 📊 **Standard Version** - Automated versioning and changelog
- 🐳 **Docker** - Dockerfile included (where applicable)

## 💻 Development

### Repository Structure

```
templates/
├── apps/                     # Application templates
│   ├── app-esbuild/
│   ├── app-tsdown/
│   ├── fastify-esbuild/
│   └── koa-esbuild/
├── bins/                     # CLI templates
│   └── bin-tsdown/
├── libs/                     # Library templates
│   ├── lib-esbuild/
│   ├── lib-rollup/
│   ├── lib-tsdown/
│   └── lib-rolldown/
├── docs/                     # Documentation templates
│   ├── docs-docsify/
│   └── docs-vitepress/
└── monorepo/                 # Monorepo templates
    └── turbo/stack/base/
```

### Commands

Run commands inside a specific template directory (for example: `templates/apps/app-esbuild`):

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Conventional commit
pnpm commit
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Commit using commitizen: `pnpm commit`
6. Push to your fork and submit a pull request

### Adding a New Template

1. Create template directory in `templates/`
2. Include all standard files (README, docs, tests)
3. Add to this README's template list
4. Update documentation

## 📄 License

ISC

## 🙏 Acknowledgments

Built with modern tools:

- [esbuild](https://esbuild.github.io/) - Extremely fast bundler
- [Rollup](https://rollupjs.org/) - Module bundler
- [tsdown](https://tsdown.dev/) - TypeScript bundler
- [Turborepo](https://turbo.build/) - High-performance build system
- [Vitest](https://vitest.dev/) - Fast unit testing
- [VitePress](https://vitepress.dev/) - Documentation framework

## 🔗 Links

- [npm Package: start-ts-by](https://www.npmjs.com/package/start-ts-by)
- [GitHub Repository](https://github.com/royfw/rfjs)
- [Docsify Documentation](./docs/docs-docsify/docs/README.md)
- [Docsify 繁體中文文檔](./docs/docs-docsify/docs/README.zh-TW.md)
- [VitePress Documentation](./docs/docs-vitepress/docs/README.md)
- [VitePress 繁體中文文檔](./docs/docs-vitepress/docs/README.zh-TW.md)

---

**Created and maintained by** [royfw](https://github.com/royfw)

For detailed information about each template, explore the [templates directory](./) or check out our [comprehensive documentation](./docs/docs-vitepress/docs/README.md).
