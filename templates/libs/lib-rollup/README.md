# lib-rollup

A production-ready TypeScript library template built with Rollup for flexible and powerful bundling.

## ✨ Features

- **🎯 Battle-Tested** - Rollup is the industry standard for library bundling
- **📦 Dual Output** - ESM and CJS formats with optimal tree-shaking
- **🔷 TypeScript** - Full TypeScript support with declaration bundling
- **🔌 Rich Plugin Ecosystem** - Access to hundreds of official Rollup plugins
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
lib-rollup/
├── src/
│   ├── index.ts              # Library entry point
│   └── utils/                # Utility functions
├── dist/                     # Build output
│   ├── index.js             # CJS bundle
│   ├── index.mjs            # ESM bundle
│   └── index.d.ts           # Type declarations
├── rollup.config.ts         # Rollup configuration
└── package.json             # Package configuration
```

## 📚 Documentation

For detailed documentation, see [docs/README.md](./docs/README.md) or [繁體中文文檔](./docs/README.zh-TW.md).

## 🛠️ Tech Stack

- **Build Tool**: Rollup 4.36+
- **Language**: TypeScript 5.7+
- **Testing**: Vitest 3.2+
- **Package Manager**: pnpm 10.24+
- **Node.js**: 18+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)