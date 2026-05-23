# koa-esbuild

A production-ready Koa application template built with [esbuild](https://esbuild.github.io/). Perfect for building REST APIs, microservices, and web services with TypeScript using the lightweight and flexible Koa framework.

## ✨ Features

- ⚡ **Lightning Fast** - Koa + esbuild for maximum performance
- 🚀 **Production Ready** - Complete API server with routing, validation, and middleware
- 🎯 **Routing Controllers** - Decorator-based routing with automatic OpenAPI generation
- 📚 **Auto Documentation** - Built-in Swagger UI documentation
- 🧪 **Complete Testing** - Vitest for unit and E2E tests
- 🔍 **Type Safety** - Strict TypeScript configuration
- 💉 **Dependency Injection** - Built-in IoC container with tsyringe
- 🎨 **Code Quality** - ESLint, Prettier, and Git hooks pre-configured

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
pnpm dev          # esbuild watch + type checking + auto-reload
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
koa-esbuild/
├── src/
│   ├── main.ts               # Application entry point
│   ├── koaApp.ts            # Koa app configuration
│   ├── server.ts            # Server setup
│   ├── ioc/                 # IoC container setup
│   └── utils/               # Utility modules
├── test/                    # E2E tests
└── docs/                    # VitePress documentation
```

## 🌐 API Endpoints

Once started, the server provides:

- **API**: `http://localhost:3000`
- **Swagger UI**: `http://localhost:3000/docs`
- **Health Check**: Available via routing-controllers

## 🔧 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Koa 3.0+
- **Language**: TypeScript 5.7+
- **Build Tool**: esbuild 0.25+
- **Testing**: Vitest 3.2+
- **Package Manager**: pnpm 10.24+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)

For more templates, check out the [template collection](https://github.com/royfw/rfjs/tree/main/templates).