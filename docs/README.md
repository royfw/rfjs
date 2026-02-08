# start-ts-templates Documentation

Comprehensive documentation for the start-ts-templates monorepo - a collection of production-ready TypeScript project templates.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Template Catalog](#template-catalog)
- [Architecture](#architecture)
- [Usage Guide](#usage-guide)
- [Development](#development)
- [Contributing](#contributing)

## Overview

**start-ts-templates** is a curated monorepo containing 12 specialized TypeScript templates designed to accelerate development workflows. Each template represents best practices for its specific use case, from web applications to libraries, CLI tools, and documentation sites.

### Philosophy

- **Production-First**: Every template is production-ready with complete tooling
- **Best Practices**: Industry-standard configurations and patterns
- **Developer Experience**: Fast builds, instant feedback, comprehensive testing
- **Flexibility**: Choose the right tool for your needs
- **Documentation**: Extensive docs in English and 繁體中文

### What's Included

- 🎯 **4 Application Templates** - Various frameworks and build tools
- 📚 **3 Library Templates** - Different bundlers for different needs
- 🛠️ **1 CLI Template** - Command-line tool scaffold
- 📝 **2 Documentation Templates** - Client-side and SSG options
- 🏗️ **1 Monorepo Template** - Full-stack with Turborepo

## Getting Started

### Prerequisites

- **Node.js**: 18 or higher
- **pnpm**: 10.24.0 or higher (enforced by preinstall script)
- **Git**: For version control

### Installation Methods

#### Method 1: Using start-ts-by CLI (Recommended)

```bash
# Install globally
npm install -g start-ts-by

# Create a new project
start-ts-by create my-project

# Or with specific template
start-ts-by create my-api --template fastify-esbuild

# Or use npx (no install)
npx start-ts-by create my-app --template app-esbuild
```

#### Method 2: Clone and Copy

```bash
# Clone the repository
git clone https://github.com/royfw/start-ts-templates.git

# Navigate to desired template
cd start-ts-templates/templates/app-esbuild

# Remove git history
rm -rf .git

# Initialize new repository
git init

# Install dependencies
pnpm install
```

#### Method 3: Download Template

Download specific template from GitHub:
```
https://github.com/royfw/start-ts-templates/tree/main/templates/{template-name}
```

### Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## Template Catalog

### Application Templates

#### app-esbuild

**Purpose**: General-purpose TypeScript application development

**Key Features**:
- esbuild for 10-100x faster builds
- Multiple build modes (esbuild, tsx, tsc)
- Vitest for testing
- VitePress documentation
- Docker ready

**Best For**:
- CLI tools
- Backend services
- Node.js applications
- Rapid prototyping

**Tech Stack**:
- Build: esbuild 0.25+
- Testing: Vitest 3.2+
- Runtime: Node.js 18+

[📖 Documentation](../templates/app-esbuild/docs/README.md)

---

#### app-tsdown

**Purpose**: Optimized applications with minimal bundle size

**Key Features**:
- tsdown for modern bundling
- Optimized output
- Tree-shaking
- Fast builds

**Best For**:
- Production applications
- Size-critical apps
- Serverless functions

**Tech Stack**:
- Build: tsdown
- Testing: Vitest 3.2+
- Runtime: Node.js 18+

[📖 Documentation](../templates/app-tsdown/docs/README.md)

---

#### fastify-esbuild

**Purpose**: High-performance REST API development

**Key Features**:
- Fastify 5.6+ framework
- Auto-generated Swagger documentation
- Plugin system
- Request validation
- esbuild for fast builds

**Best For**:
- REST APIs
- Microservices
- Backend services
- API gateways

**Tech Stack**:
- Framework: Fastify 5.6+
- Build: esbuild 0.25+
- Testing: Vitest 3.2+
- Docs: Swagger/OpenAPI

[📖 Documentation](../templates/fastify-esbuild/docs/README.md)

---

#### koa-esbuild

**Purpose**: Lightweight web application development

**Key Features**:
- Koa 3.0+ framework
- Decorator-based routing (routing-controllers)
- Dependency injection (tsyringe)
- OpenAPI documentation
- Middleware-based architecture

**Best For**:
- Web applications
- REST APIs
- Flexible middleware needs
- IoC pattern projects

**Tech Stack**:
- Framework: Koa 3.0+
- Build: esbuild 0.25+
- DI: tsyringe 4.10+
- Testing: Vitest 3.2+

[📖 Documentation](../templates/koa-esbuild/docs/README.md)

### Library Templates

#### lib-rollup

**Purpose**: Industry-standard library bundling

**Key Features**:
- Rollup for optimal tree-shaking
- Dual output (ESM + CJS)
- TypeScript declarations
- Rich plugin ecosystem

**Best For**:
- npm packages
- Shared libraries
- Component libraries
- Framework plugins

**Output Formats**:
- ESM (`.mjs`)
- CommonJS (`.js`)
- TypeScript declarations (`.d.ts`)

**Tech Stack**:
- Build: Rollup 4.36+
- Testing: Vitest 3.2+

[📖 Documentation](../templates/lib-rollup/docs/README.md)

---

#### lib-tsdown

**Purpose**: Modern library development with fast builds

**Key Features**:
- tsdown for optimized bundling
- Minimal bundle size
- Fast build times
- ESM + CJS output

**Best For**:
- Modern npm packages
- Utility libraries
- Size-critical libraries

**Tech Stack**:
- Build: tsdown
- Testing: Vitest 3.2+

[📖 Documentation](../templates/lib-tsdown/docs/README.md)

---

#### lib-rolldown

**Purpose**: Next-generation library bundling

**Key Features**:
- Rolldown (Rollup + esbuild)
- Best of both worlds
- High performance
- Modern output

**Best For**:
- High-performance libraries
- Large-scale packages
- Framework development

**Tech Stack**:
- Build: Rolldown
- Testing: Vitest 3.2+

[📖 Documentation](../templates/lib-rolldown/docs/README.md)

### CLI Templates

#### bin-tsdown

**Purpose**: Command-line tool development

**Key Features**:
- Optimized CLI bundling
- Commander.js integration
- Cross-platform support
- Executable output

**Best For**:
- CLI tools
- Scaffolding tools
- Build tools
- Automation scripts

**Tech Stack**:
- Build: tsdown
- CLI: Commander.js
- Testing: Vitest 3.2+

[📖 Documentation](../templates/bin-tsdown/docs/README.md)

### Documentation Templates

#### docs-docsify

**Purpose**: Zero-build documentation sites

**Key Features**:
- Client-side rendering
- No build process
- Instant deployment
- Plugin ecosystem
- Full-text search

**Best For**:
- Quick documentation
- Simple project docs
- GitHub Pages
- Static hosting

**Tech Stack**:
- Framework: Docsify
- Optional Build: esbuild/Rollup
- Testing: Jest 29.7+

[📖 Documentation](../templates/docs-docsify/docs/README.md)

---

#### docs-vitepress

**Purpose**: Powerful SSG documentation sites

**Key Features**:
- VitePress 1.6+ (Vue-powered SSG)
- Lightning-fast HMR
- Vue components in Markdown
- Built-in search
- SEO optimized

**Best For**:
- Technical documentation
- API references
- Component libraries
- Large documentation sites

**Tech Stack**:
- Framework: VitePress 1.6+
- Build: Vite (Rollup + esbuild)
- UI: Vue 3
- Testing: Vitest/Jest

[📖 Documentation](../templates/docs-vitepress/docs/README.md)

### Monorepo Templates

#### turbo

**Purpose**: Full-stack monorepo development

**Key Features**:
- Turborepo for build caching
- Next.js web application
- Shared packages
- Workspace management
- Optimized pipelines

**Best For**:
- Large-scale projects
- Multi-app systems
- Microservices
- Design systems

**Tech Stack**:
- Build System: Turborepo 2.6+
- Framework: Next.js
- Package Manager: pnpm
- Testing: Vitest

[📖 Documentation](../templates/turbo/docs/README.md)

## Architecture

### Repository Structure

```
start-ts-templates/
├── .husky/                    # Git hooks
├── docs/                      # Repository documentation
│   ├── README.md             # This file
│   └── README.zh-TW.md       # 繁體中文版本
├── packages/                  # Shared packages
│   ├── eslint-config/        # Shared ESLint configs
│   ├── typescript-config/    # Shared TypeScript configs
│   └── ui/                   # Shared UI components
├── templates/                 # Template projects
│   ├── app-esbuild/
│   ├── app-tsdown/
│   ├── fastify-esbuild/
│   ├── koa-esbuild/
│   ├── lib-rollup/
│   ├── lib-tsdown/
│   ├── lib-rolldown/
│   ├── bin-tsdown/
│   ├── docs-docsify/
│   ├── docs-vitepress/
│   └── turbo/
├── package.json               # Root package configuration
├── pnpm-workspace.yaml       # pnpm workspace config
├── turbo.json                # Turborepo configuration
└── README.md                 # Repository README
```

### Common Patterns

#### File Structure (Typical Template)

```
template-name/
├── src/                      # Source code
│   ├── index.ts             # Entry point
│   ├── configs.ts           # Configuration
│   └── utils/               # Utilities
├── test/                     # E2E tests
├── docs/                     # Documentation
│   ├── README.md            # English docs
│   └── README.zh-TW.md      # 繁體中文 docs
├── .env.example             # Environment template
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript config
├── vitest.config.mts        # Vitest config
└── README.md                # Template README
```

#### Standard Scripts

All templates include:

```json
{
  "scripts": {
    "dev": "...",           // Development mode
    "build": "...",         // Production build
    "test": "...",          // Run tests
    "lint": "...",          // Lint code
    "typecheck": "...",     // Type checking
    "commit": "npx cz",     // Conventional commits
    "release": "..."        // Version bump
  }
}
```

## Usage Guide

### Choosing the Right Template

#### For Applications

- **Simple app or CLI**: `app-esbuild`
- **Optimized bundle**: `app-tsdown`
- **REST API (performance)**: `fastify-esbuild`
- **REST API (flexible)**: `koa-esbuild`

#### For Libraries

- **Standard npm package**: `lib-rollup`
- **Modern, lightweight**: `lib-tsdown`
- **High performance**: `lib-rolldown`

#### For CLI Tools

- **Command-line tools**: `bin-tsdown`

#### For Documentation

- **Quick & simple**: `docs-docsify`
- **Feature-rich**: `docs-vitepress`

#### For Monorepos

- **Multi-app project**: `turbo`

### Customization

#### Adding Dependencies

```bash
# Add production dependency
pnpm add <package>

# Add dev dependency
pnpm add -D <package>
```

#### Modifying Configuration

Common config files:
- `tsconfig.json` - TypeScript configuration
- `eslint.config.mjs` - ESLint rules
- `.prettierrc` - Prettier formatting
- `vitest.config.mts` - Vitest settings

#### Environment Variables

1. Copy `.env.example` to `.env.local`
2. Update values
3. Never commit `.env.local`

### Testing

#### Unit Tests

```bash
# Run tests
pnpm test

# Watch mode
pnpm vitest

# Coverage
pnpm vitest:run --coverage

# UI mode
pnpm vitest:ui
```

#### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# E2E with UI
pnpm vitest:e2e:ui
```

### Deployment

#### Building for Production

```bash
# Clean build
pnpm clean
pnpm build

# Output is in ./dist or specified output directory
```

#### Docker Deployment

Many templates include Dockerfile:

```bash
# Build image
docker build -t my-app .

# Run container
docker run -p 3000:3000 my-app
```

#### CI/CD

Templates work well with:
- GitHub Actions
- GitLab CI
- Jenkins
- CircleCI

Example GitHub Actions:

```yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
```

## Development

### Contributing to Templates

#### Setting Up

```bash
# Clone repository
git clone https://github.com/royfw/start-ts-templates.git
cd start-ts-templates

# Install dependencies
pnpm install

# Run specific template
cd templates/app-esbuild
pnpm dev
```

#### Making Changes

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Commit using commitizen: `pnpm commit`
6. Push and create PR

#### Adding New Template

1. Create directory in `templates/`
2. Set up standard structure
3. Add package.json with standard scripts
4. Create documentation (README + docs/)
5. Add tests
6. Update root README
7. Update this documentation

### Monorepo Commands

```bash
# Install all dependencies
pnpm install

# Run all templates in dev mode
pnpm dev

# Build all templates
pnpm build

# Test all templates
pnpm test

# Lint all code
pnpm lint

# Type check everything
pnpm typecheck

# Format all code
pnpm format
```

### Turborepo

The repository uses Turborepo for:
- Parallel task execution
- Smart caching
- Task dependencies
- Remote caching (optional)

Configuration in `turbo.json`.

## Best Practices

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Format with Prettier
- Use conventional commits

### Testing

- Write tests alongside code
- Aim for high coverage on business logic
- Use E2E tests for critical paths
- Keep tests fast and isolated

### Documentation

- Update README when adding features
- Keep docs/ in sync
- Provide code examples
- Document breaking changes

### Version Control

- Use semantic versioning
- Generate changelogs automatically
- Tag releases properly
- Document migration paths

## Troubleshooting

### Common Issues

**pnpm install fails**
```bash
# Clear cache and reinstall
pnpm store prune
rm -rf node_modules
pnpm install
```

**Build errors**
```bash
# Clean and rebuild
pnpm clean
pnpm build
```

**Type errors**
```bash
# Run type check
pnpm typecheck
```

**Port conflicts**
```bash
# Change port in .env.local
PORT=3001
```

## Additional Resources

- [TypeScript Documentation](https://www.typescriptlang.org/)
- [pnpm Documentation](https://pnpm.io/)
- [Turborepo Documentation](https://turbo.build/)
- [Vitest Documentation](https://vitest.dev/)
- [esbuild Documentation](https://esbuild.github.io/)

## License

ISC

## Support

- [GitHub Issues](https://github.com/royfw/start-ts-templates/issues)
- [Discussions](https://github.com/royfw/start-ts-templates/discussions)

---

**Maintained by** [royfw](https://github.com/royfw)

For 繁體中文版本, see [README.zh-TW.md](./README.zh-TW.md)