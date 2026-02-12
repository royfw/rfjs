# Turborepo Monorepo Template

A modern monorepo template powered by Turborepo, featuring Next.js and shared packages for scalable multi-project development.

## ✨ Features

- **🚀 Turborepo** - High-performance build system for JavaScript/TypeScript monorepos
- **⚡ Fast Builds** - Intelligent caching and parallel execution
- **📦 Workspaces** - Organized apps and packages structure
- **🎯 Next.js 15** - Latest Next.js with Turbopack
- **🔷 TypeScript** - Full type safety across all packages
- **🎨 Shared UI** - Reusable component library
- **📝 Code Quality** - ESLint, Prettier, Husky pre-configured

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run all apps in development
pnpm dev

# Build all apps and packages
pnpm build

# Run tests across all packages
pnpm test
```

## 📁 Project Structure

```
turbo/
├── apps/
│   └── web/                  # Next.js application
├── packages/
│   ├── ui/                   # Shared UI components
│   ├── eslint-config/        # Shared ESLint config
│   └── typescript-config/    # Shared TypeScript config
├── turbo.json               # Turborepo configuration
└── package.json             # Root package configuration
```

## 📚 Documentation

For detailed documentation, see [docs/README.md](./docs/README.md) or [繁體中文文檔](./docs/README.zh-TW.md).

## 🛠️ Tech Stack

- **Monorepo**: Turborepo 2.6+
- **Framework**: Next.js 15.1+
- **UI Library**: React 19+
- **Language**: TypeScript 5.7+
- **Package Manager**: pnpm 10.24+
- **Node.js**: 18+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)