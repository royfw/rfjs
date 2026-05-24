# fastify-esbuild

A production-ready Fastify application template built with [esbuild](https://esbuild.github.io/). Perfect for building high-performance REST APIs, microservices, and web services with TypeScript.

## ✨ Features

- ⚡ **Lightning Fast** - Fastify + esbuild for maximum performance
- 🚀 **Production Ready** - Complete API server with routing, validation, and documentation
- 🔌 **Plugin System** - Modular architecture with Fastify plugins
- 📚 **Auto Documentation** - Built-in Swagger/OpenAPI documentation
- 🧪 **Complete Testing** - Vitest for unit and E2E tests
- 🐳 **Docker Ready** - Multi-stage Dockerfiles with Turbo optimization
- 🎯 **Type Safety** - Strict TypeScript configuration
- 🔍 **Code Quality** - ESLint, Prettier, and Git hooks pre-configured

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
fastify-esbuild/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── configs.ts                 # Configuration loader
│   ├── delivery/http/             # HTTP route modules
│   │   ├── app/                   # App routes
│   │   └── health/                # Health check routes
│   ├── infrastructures/           # Core infrastructure
│   │   ├── fastify/               # Fastify setup
│   │   └── server/                # Server management
│   └── utils/                     # Utility modules
├── test/                          # E2E tests
└── docs/                          # VitePress documentation
```

## 🌐 API Endpoints

Once started, the server provides:

- **API**: `http://localhost:3000`
- **Swagger UI**: `http://localhost:3000/docs`
- **Health Check**: `http://localhost:3000/health`

## 🔧 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify 5.6+
- **Language**: TypeScript 5.7+
- **Build Tool**: esbuild 0.25+
- **Testing**: Vitest 3.2+
- **Package Manager**: pnpm 10.24+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)

For more templates, check out the [template collection](https://github.com/royfw/rfjs/tree/main/templates).
