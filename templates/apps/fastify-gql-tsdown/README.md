# app-tsdown

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.24.0-orange.svg)](https://pnpm.io/)

A modern TypeScript application template built with [tsdown](https://tsdown.dev/) for ultra-fast builds, simplified configuration, and production-ready development environment.

## ✨ Features

- ⚡ **Lightning Fast** - tsdown provides millisecond-level compilation speed
- 🎯 **Zero Config Build** - Out-of-the-box TypeScript build tool
- 🔄 **Hot Reload** - Auto-detect file changes and restart
- 🧪 **Vitest Testing** - Fast unit and E2E testing
- 📝 **Code Quality** - ESLint + Prettier + auto-formatting
- 🔧 **Multiple Build Options** - Support for tsdown, tsx, and tsc
- 📚 **VitePress Documentation** - Built-in documentation site
- 🪝 **Git Hooks** - Husky + lint-staged for automated checks
- 📦 **Environment Management** - dotenv-flow for multi-environment configuration

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: v10.24.0 or higher

```bash
# Check Node.js version
node --version

# Install pnpm (if not already installed)
npm install -g pnpm@10.24.0
```

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local
```

### Development

Start development mode (with tsdown + watch):

```bash
pnpm dev
```

Other development modes:

```bash
# Use tsx watch mode (faster startup)
pnpm dev:tsx

# Use TypeScript compiler watch mode
pnpm dev:tsc
```

### Build

```bash
# Build with tsdown (recommended)
pnpm build

# Build with TypeScript compiler
pnpm build:tsc
```

### Testing

```bash
# Run unit tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Use UI mode
pnpm vitest:ui
```

### Run

```bash
# Run built application
pnpm start
```

## 📖 Documentation

For complete documentation, see:
- [English Documentation](./docs/README.md)
- [繁體中文文檔](./docs/README.zh-TW.md)

## 📜 Available Scripts

### Development

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development mode (tsdown watch + typecheck) |
| `pnpm dev:tsx` | Use tsx watch mode |
| `pnpm dev:tsdown` | Use tsdown watch mode |
| `pnpm dev:tsc` | Use tsc watch mode |
| `pnpm tsx` | Run source code with tsx |
| `pnpm tsx:watch` | tsx watch mode |

### Build

| Script | Description |
|--------|-------------|
| `pnpm build` | Production build (tsdown) |
| `pnpm build:tsdown` | Build with tsdown |
| `pnpm build:tsdown:watch` | tsdown watch mode |
| `pnpm build:tsc` | Build with TypeScript compiler |
| `pnpm clean` | Clean build artifacts |

### Testing

| Script | Description |
|--------|-------------|
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm vitest` | Vitest watch mode |
| `pnpm vitest:ui` | Vitest UI mode |

### Code Quality

| Script | Description |
|--------|-------------|
| `pnpm lint` | Check code style |
| `pnpm lint:fix` | Auto-fix code style issues |
| `pnpm typecheck` | Type checking |
| `pnpm typecheck:watch` | Type checking watch mode |

### Documentation

| Script | Description |
|--------|-------------|
| `pnpm docs:dev` | Start documentation dev server |
| `pnpm docs:build` | Build documentation site |
| `pnpm docs:preview` | Preview built documentation |

### Version Management

| Script | Description |
|--------|-------------|
| `pnpm commit` | Commit with Commitizen |

## 🏗️ Project Structure

```
app-tsdown/
├── src/                    # Source code
│   ├── main.ts            # Application entry point
│   ├── configs.ts         # Configuration
│   └── utils/             # Utility functions
├── docs/                  # VitePress documentation
├── tsconfig.json          # TypeScript configuration
├── vitest.config.mts      # Vitest configuration
└── package.json           # Project configuration
```

## 🛠️ Tech Stack

- **Runtime**: Node.js ≥18
- **Language**: TypeScript 5.7.3
- **Build Tool**: tsdown 0.17.3
- **Testing**: Vitest 3.2.3
- **Linting**: ESLint 9.20.1 + typescript-eslint 8.24.0
- **Formatting**: Prettier 3.5.1
- **Documentation**: VitePress 1.6.3
- **Package Manager**: pnpm 10.24.0

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`pnpm commit`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)

For more templates, check out the [template collection](https://github.com/royfw/rfjs/tree/main/templates).