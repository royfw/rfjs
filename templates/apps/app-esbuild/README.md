# app-esbuild

A production-ready TypeScript application template built with [esbuild](https://esbuild.github.io/), the extremely fast JavaScript bundler. Perfect for starting Node.js applications, CLI tools, backend services, and more.

## ✨ Features

- ⚡ **Lightning Fast** - esbuild provides 10-100x faster builds than traditional tools
- 🔥 **Multiple Build Options** - Choose between esbuild, tsx, or tsc based on your needs
- 🧪 **Complete Testing** - Vitest for unit and E2E tests with coverage
- 📦 **Docker Ready** - Multi-stage Dockerfiles with Turbo optimization
- 🔍 **Type Safety** - Strict TypeScript configuration
- 🎯 **Code Quality** - ESLint, Prettier, and Git hooks pre-configured
- 📝 **Documentation** - Built-in VitePress documentation site

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## 📖 Documentation

For complete documentation, see:
- [English Documentation](./docs/README.md)
- [繁體中文文檔](./docs/README.zh-TW.md)

## 🛠️ Development Scripts

```bash
# Development modes
pnpm dev          # esbuild watch + type checking
pnpm dev:tsx      # tsx instant start (no build)
pnpm dev:esbuild  # esbuild watch only

# Build
pnpm build        # Production build with esbuild
pnpm build:tsc    # TypeScript compiler build

# Testing
pnpm test         # Run unit tests
pnpm test:e2e     # Run E2E tests
pnpm vitest:ui    # Launch Vitest UI

# Code Quality
pnpm lint         # Check code style
pnpm typecheck    # Verify types
```

## 📁 Project Structure

```
app-esbuild/
├── src/
│   ├── main.ts           # Application entry point
│   ├── configs.ts        # Configuration loader
│   └── utils/            # Utility modules
├── test/                 # E2E tests
├── docs/                 # VitePress documentation
├── esbuild.build.ts      # Production build config
└── esbuild.dev.ts        # Development build config
```

## 🔧 Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.7+
- **Build Tool**: esbuild 0.25+
- **Testing**: Vitest 3.2+
- **Package Manager**: pnpm 10.24+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)

For more templates, check out the [template collection](https://github.com/royfw/rfjs/tree/main/templates).