# lib-rolldown

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue.svg)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.24.0-orange.svg)](https://pnpm.io/)

A modern TypeScript library template built with [Rolldown](https://rolldown.rs/), combining the best of Rollup and esbuild for blazing-fast builds and optimal bundle output.

## ✨ Features

- ⚡ **Blazing Fast** - Rolldown provides Rust-level compilation speed
- 📦 **Dual Output** - Both CommonJS (CJS) and ES Modules (ESM)
- 🎯 **Full Type Definitions** - Auto-generated `.d.ts` declaration files
- 🌳 **Tree-shaking Friendly** - Optimized bundle configuration
- 🧪 **Vitest Testing** - Fast unit and E2E testing framework
- 📝 **Code Quality** - ESLint + Prettier + auto-formatting
- 🔄 **Watch Mode** - Auto-rebuild during development
- 📚 **VitePress Documentation** - Built-in documentation site
- 🪝 **Git Hooks** - Husky + lint-staged for code quality
- 🚀 **Publish Ready** - Complete npm publishing configuration

## 🚀 Quick Start

### Prerequisites

- **Node.js**: v18 or higher
- **pnpm**: v10.24.0 or higher

```bash
# Check versions
node --version
pnpm --version

# Install pnpm (if needed)
npm install -g pnpm@10.24.0
```

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

Start development mode (watch auto-rebuild):

```bash
pnpm dev
```

### Build

Build production version:

```bash
# Build library (CJS + ESM + type definitions)
pnpm build

# Output files:
# - dist/index.js (CommonJS)
# - dist/index.mjs (ES Module)
# - dist/index.d.ts (TypeScript definitions)
```

### Testing

```bash
# Run unit tests
pnpm test

# Watch mode testing
pnpm vitest

# UI mode
pnpm vitest:ui

# With coverage
pnpm vitest:run --coverage
```

## 📖 Documentation

For complete documentation, see:
- [English Documentation](./docs/README.md)
- [繁體中文文檔](./docs/README.zh-TW.md)

## 📜 Available Scripts

### Development

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start watch mode (build + type checking) |
| `pnpm dev:rolldown` | Rolldown watch mode only |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm typecheck:watch` | Type checking watch mode |

### Build

| Script | Description |
|--------|-------------|
| `pnpm build` | Production build (CJS + ESM + types) |
| `pnpm build:rolldown` | Build with Rolldown |
| `pnpm clean` | Clean dist/ and types/ directories |
| `pnpm clean:dist` | Clean dist/ only |
| `pnpm clean:types` | Clean types/ only |

### Testing

| Script | Description |
|--------|-------------|
| `pnpm test` | Run all tests |
| `pnpm vitest` | Vitest watch mode |
| `pnpm vitest:ui` | Vitest UI mode |
| `pnpm vitest:run` | Run tests once |

### Code Quality

| Script | Description |
|--------|-------------|
| `pnpm lint` | Check code style |
| `pnpm lint:fix` | Auto-fix code style issues |

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
lib-rolldown/
├── src/                    # Source code
│   ├── index.ts           # Library entry point
│   └── utils/             # Utility functions
│       └── demo/          # Demo modules
├── dist/                  # Build output (gitignored)
│   ├── index.js          # CommonJS bundle
│   ├── index.mjs         # ESM bundle
│   └── index.d.ts        # Type definitions
├── types/                 # Type files (gitignored)
├── docs/                  # VitePress documentation
├── rolldown.config.ts     # Rolldown configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Package configuration
```

## 📦 Package.json Configuration

Ensure your `package.json` includes these key fields:

```json
{
  "name": "your-library-name",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ]
}
```

## 🔧 Usage Example

After installing your library:

```typescript
// ESM
import { getDemoValue } from 'your-library-name';

const value = getDemoValue();
console.log(value); // 'demo'

// CommonJS
const { getDemoValue } = require('your-library-name');

const value = getDemoValue();
console.log(value); // 'demo'
```

## 🚀 Publishing to npm

```bash
# 1. Build the library
pnpm build

# 2. Test the build output
node -e "console.log(require('./dist/index.js'))"

# 3. Publish to npm
npm publish
```

## 🛠️ Tech Stack

- **Runtime**: Node.js ≥18
- **Language**: TypeScript 5.7.3
- **Build Tool**: Rolldown 1.0.0-beta.53
- **Type Generation**: rollup-plugin-dts 6.2.1
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