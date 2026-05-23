# lib-tsdown

A modern TypeScript library template built with tsdown for zero-config, lightning-fast builds.

## ✨ Features

- **⚡ Zero Config** - Works out of the box with sensible defaults
- **🚀 Ultra-Fast** - Powered by Oxc for blazing performance
- **📦 Dual Output** - ESM and CJS formats automatically
- **🔷 TypeScript** - Full TypeScript support with isolated declarations
- **✅ Testing Ready** - Vitest configured for comprehensive testing
- **📝 Code Quality** - ESLint, Prettier, Husky, and lint-staged pre-configured

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Development with watch mode
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## 📁 Project Structure

```
lib-tsdown/
├── src/
│   ├── index.ts              # Library entry point
│   └── utils/                # Utility functions
├── dist/                     # Build output
│   ├── index.js             # CJS bundle
│   ├── index.mjs            # ESM bundle
│   └── index.d.ts           # Type declarations
├── tsdown.config.ts         # tsdown configuration
└── package.json             # Package configuration
```

## 📚 Documentation

For detailed documentation, see [docs/README.md](./docs/README.md) or [繁體中文文檔](./docs/README.zh-TW.md).

## 🛠️ Tech Stack

- **Build Tool**: tsdown 0.17+
- **Language**: TypeScript 5.7+
- **Testing**: Vitest 3.2+
- **Package Manager**: pnpm 10.24+
- **Node.js**: 18+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)
