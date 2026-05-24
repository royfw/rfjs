# bin-tsdown

A modern CLI tool template built with TypeScript and tsdown for creating powerful command-line applications.

## ✨ Features

- **🎯 Interactive CLI** - Built with Commander.js and Inquirer
- **⚡ Fast Builds** - Powered by tsdown for quick compilation
- **🔷 TypeScript** - Full type safety for CLI development
- **📦 Zero Config** - Works out of the box with sensible defaults
- **✅ Testing Ready** - Vitest configured for CLI testing
- **📝 Code Quality** - ESLint, Prettier, Husky pre-configured

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run in development
pnpm tsx

# Build for production
pnpm build

# Run tests
pnpm test
```

## 📦 CLI Usage

```bash
# Create a new project
npm run tsx create my-project

# Create with template option
npm run tsx create my-project -t user/repo

# Interactive mode
npm run tsx create
```

## 📁 Project Structure

```
bin-tsdown/
├── src/
│   ├── index.ts              # CLI entry point
│   └── libs/                 # CLI logic
├── dist/                     # Build output
│   └── bin/                  # Executable files
├── templates.json            # Template configurations
└── package.json
```

## 📚 Documentation

For detailed documentation, see [docs/README.md](./docs/README.md) or [繁體中文文檔](./docs/README.zh-TW.md).

## 🛠️ Tech Stack

- **Build Tool**: tsdown 0.17+
- **CLI Framework**: Commander.js 13+
- **Interactive Prompts**: Inquirer 12+
- **Language**: TypeScript 5.7+
- **Testing**: Vitest 3.2+
- **Package Manager**: pnpm 10.24+
- **Node.js**: 18+

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)