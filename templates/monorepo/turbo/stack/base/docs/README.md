# Turborepo Monorepo - Documentation

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Monorepo Structure](#-monorepo-structure)
- [Core Features](#-core-features)
- [Development](#-development)
- [Turborepo Configuration](#-turborepo-configuration)
- [Adding New Packages](#-adding-new-packages)
- [Workspace Management](#-workspace-management)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Best Practices](#-best-practices)

## 🎯 Project Overview

**Turborepo Monorepo** is a production-ready monorepo template powered by Turborepo, designed for building scalable multi-project applications. It includes a Next.js application and shared packages for UI components, ESLint configs, and TypeScript configurations.

### Why Turborepo?

- **Blazing Fast** - Intelligent caching and parallel execution
- **Incremental Builds** - Only rebuild what changed
- **Remote Caching** - Share cache across teams
- **Task Pipelines** - Define task dependencies
- **Workspace Management** - Seamless package dependencies

### Use Cases

- Multi-application projects
- Component libraries with documentation
- Microservices architecture
- Shared tooling and configurations
- Design systems

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10.24+

### Installation

```bash
# Create from template
degit royfw/rfjs/templates/monorepo/turbo/stack/base my-monorepo
cd my-monorepo

# Install all dependencies
pnpm install

# Start all apps in development
pnpm dev
```

### First Build

```bash
# Build all apps and packages
pnpm build

# Run specific workspace
pnpm --filter web dev
```

## 📁 Monorepo Structure

```
turbo/
├── apps/                             # Applications
│   └── web/                         # Next.js app
│       ├── app/                     # Next.js App Router
│       ├── public/                  # Static assets
│       └── package.json             # App dependencies
├── packages/                         # Shared packages
│   ├── ui/                          # UI component library
│   │   ├── src/                    # Components
│   │   └── package.json            # Package config
│   ├── eslint-config/              # ESLint configurations
│   │   ├── base.js                 # Base config
│   │   ├── next.js                 # Next.js config
│   │   └── react-internal.js       # React config
│   └── typescript-config/          # TypeScript configs
│       ├── base.json               # Base config
│       ├── nextjs.json             # Next.js config
│       └── react-library.json      # Library config
├── turbo.json                       # Turborepo configuration
├── pnpm-workspace.yaml             # Workspace definition
└── package.json                     # Root package
```

## ✨ Core Features

### 1. Turborepo Build System

High-performance monorepo tool:

- **Task Caching** - Never rebuild the same thing twice
- **Parallel Execution** - Run tasks across workspaces simultaneously
- **Task Pipelines** - Define task dependencies
- **Remote Caching** - Share cache across team/CI
- **Incremental Builds** - Only rebuild changed packages

### 2. Workspace Management

PNPM workspaces for dependency management:

- **Shared Dependencies** - Deduplicated node_modules
- **Workspace Protocol** - Reference local packages
- **Fast Installation** - Content-addressable storage
- **Strict Mode** - Prevent phantom dependencies

### 3. Next.js Integration

Modern web application:

- **App Router** - Latest Next.js architecture
- **Turbopack** - Faster development builds
- **React 19** - Latest React features
- **TypeScript** - Full type safety

### 4. Shared Packages

Reusable packages across apps:

- **UI Components** - Shared React components
- **ESLint Config** - Consistent code style
- **TypeScript Config** - Shared type configurations

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev                    # Run all apps in dev mode
pnpm --filter web dev       # Run specific app

# Build
pnpm build                  # Build all apps and packages
pnpm --filter web build     # Build specific app

# Testing
pnpm test                   # Run all tests
pnpm --filter ui test       # Test specific package

# Code Quality
pnpm lint                   # Lint all packages
pnpm typecheck              # Check types across monorepo
pnpm format                 # Format code with Prettier
```

### Running Specific Workspaces

```bash
# Run commands in specific workspace
pnpm --filter web dev
pnpm --filter @repo/ui build

# Run in multiple workspaces
pnpm --filter "web" --filter "@repo/ui" dev
```

### Development Workflow

1. **Start development server**:
```bash
pnpm dev
```

2. **Make changes** to apps or packages

3. **See hot reload** - Changes reflect immediately

4. **Build and test**:
```bash
pnpm build
pnpm test
```

## ⚙️ Turborepo Configuration

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^test"]
    }
  }
}
```

### Task Dependencies

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],  // Build dependencies first
      "outputs": ["dist/**"]
    }
  }
}
```

### Caching

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],      // Cache these outputs
      "inputs": ["src/**", "*.ts"] // Invalidate on these changes
    }
  }
}
```

## 📦 Adding New Packages

### Create New Package

1. **Create package directory**:
```bash
mkdir -p packages/my-package
cd packages/my-package
```

2. **Initialize package.json**:
```json
{
  "name": "@repo/my-package",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

3. **Add to workspace**:
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Create New App

1. **Create app directory**:
```bash
mkdir -p apps/my-app
cd apps/my-app
```

2. **Initialize Next.js app**:
```bash
pnpm create next-app@latest .
```

3. **Use workspace packages**:
```json
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}
```

## 🔧 Workspace Management

### Workspace Protocol

Reference local packages:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/eslint-config": "workspace:*"
  }
}
```

### Shared Dependencies

Install dependency for specific workspace:

```bash
pnpm --filter web add react
```

Install for all workspaces:

```bash
pnpm add -w typescript
```

### Workspace Commands

```bash
# List all workspaces
pnpm -r list

# Run command in all workspaces
pnpm -r build

# Run in parallel
pnpm -r --parallel dev
```

## 🧪 Testing

### Unit Tests

```typescript
// packages/ui/src/button.spec.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('should render', () => {
    const { getByText } = render(<Button>Click me</Button>);
    expect(getByText('Click me')).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// apps/web/tests/home.spec.ts
import { test, expect } from '@playwright/test';

test('home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading')).toContain('Welcome');
});
```

## 🚀 Deployment

### Vercel Deployment

Turborepo is optimized for Vercel:

```bash
# Vercel will automatically detect turbo.json
vercel deploy
```

### Docker Deployment

```dockerfile
FROM node:18-alpine AS base
RUN corepack enable pnpm

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm turbo build --filter=web

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### Remote Caching

Enable remote caching for teams:

```bash
# Link to Vercel
npx turbo login
npx turbo link
```

## 🎯 Best Practices

### 1. Package Naming

```json
// ✅ Good - Scoped naming
{
  "name": "@repo/ui",
  "name": "@repo/eslint-config"
}

// ❌ Avoid - Generic names
{
  "name": "ui",
  "name": "config"
}
```

### 2. Task Organization

```json
// ✅ Good - Clear dependencies
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}

// ❌ Avoid - No dependencies
{
  "tasks": {
    "build": {}
  }
}
```

### 3. Workspace Dependencies

```json
// ✅ Good - Use workspace protocol
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}

// ❌ Avoid - Hard-coded versions
{
  "dependencies": {
    "@repo/ui": "0.0.0"
  }
}
```

### 4. Shared Configurations

```typescript
// ✅ Good - Extend shared config
// apps/web/tsconfig.json
{
  "extends": "@repo/typescript-config/nextjs.json"
}

// ❌ Avoid - Duplicate config
{
  "compilerOptions": { /* ... */ }
}
```

## 📊 Performance Tips

- Enable remote caching
- Use task pipelines effectively
- Leverage parallel execution
- Cache build outputs
- Use incremental builds

## 🔒 Security

- Keep dependencies updated
- Use workspace protocol
- Audit all packages regularly
- Implement access controls
- Use environment variables

## 🤝 Contributing

Contributions welcome! Please:
- Follow workspace structure
- Add tests for new features
- Update documentation
- Use conventional commits

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)