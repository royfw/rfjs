# lib-esbuild - Documentation

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Core Features](#-core-features)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Build Configuration](#-build-configuration)
- [Testing](#-testing)
- [Publishing](#-publishing)
- [Best Practices](#-best-practices)

## 🎯 Project Overview

**lib-esbuild** is a production-ready TypeScript library template optimized for npm package development. It leverages esbuild's exceptional speed to provide near-instant builds while maintaining full TypeScript type safety and modern tooling.

### Why lib-esbuild?

- **Blazing Fast** - esbuild compiles 10-100x faster than traditional bundlers
- **Dual Format** - Outputs both ESM and CJS for maximum compatibility
- **Type Safety** - Full TypeScript support with bundled declarations
- **Developer Experience** - Hot reload, comprehensive testing, quality tools
- **Production Ready** - Optimized builds, tree-shaking, source maps

### Use Cases

- NPM packages and libraries
- Shared component libraries
- Utility function collections
- SDK development
- Internal company packages

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10.24+

### Installation

```bash
# Create from template
degit royfw/rfjs/templates/libs/lib-esbuild my-library
cd my-library

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### First Build

```bash
# Build library
pnpm build

# Outputs:
# dist/index.js       - CommonJS bundle
# dist/index.mjs      - ES Module bundle
# dist/index.d.ts     - TypeScript declarations
```

## ✨ Core Features

### 1. esbuild Integration

Ultra-fast JavaScript/TypeScript bundler:

- **Speed** - 10-100x faster than Webpack/Rollup
- **ESM & CJS** - Dual format output
- **Tree Shaking** - Automatic dead code elimination
- **Source Maps** - For debugging built code
- **Platform Neutral** - Works in Node.js and browsers

### 2. TypeScript Configuration

Comprehensive TypeScript setup:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "strict": true
  }
}
```

### 3. Dual Package Support

Both module systems supported:

```json
{
  "main": "dist/index.js",      // CJS entry
  "module": "dist/index.mjs",   // ESM entry
  "types": "dist/index.d.ts"    // Type declarations
}
```

### 4. Development Tools

Complete development environment:

- **Vitest** - Fast unit testing
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Husky** - Git hooks
- **lint-staged** - Pre-commit checks

## 📁 Project Structure

```
lib-esbuild/
├── src/
│   ├── index.ts                    # Library entry
│   └── utils/
│       └── demo/
│           ├── getDemoValue.ts    # Example utility
│           └── getExDemoValue.ts  # Extended utility
├── test/
│   └── app.e2e-spec.ts           # E2E tests
├── scripts/
│   ├── copyPackageJsonPlugin.ts  # Build script
│   └── dtsBundlePlugin.ts        # Type declaration bundler
├── dist/                          # Build output
│   ├── index.js                  # CJS bundle
│   ├── index.mjs                 # ESM bundle
│   └── index.d.ts                # Type declarations
├── esbuild.build.ts              # Production build config
├── esbuild.dev.ts                # Development build config
└── package.json
```

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev                # Watch mode with type checking
pnpm dev:esbuild        # esbuild watch only

# Build
pnpm build              # Production build
pnpm build:esbuild      # esbuild build
pnpm clean              # Clean build artifacts

# Testing
pnpm test               # Run tests
pnpm vitest             # Interactive test mode
pnpm vitest:ui          # Test UI
pnpm vitest:e2e         # E2E tests

# Code Quality
pnpm lint               # Lint code
pnpm lint:fix           # Fix linting issues
pnpm typecheck          # Type checking
pnpm typecheck:watch    # Watch type checking
```

### Adding New Functions

1. **Create utility function**:

```typescript
// src/utils/math/add.ts
export function add(a: number, b: number): number {
  return a + b;
}
```

2. **Export from index**:

```typescript
// src/utils/math/index.ts
export * from './add';

// src/utils/index.ts
export * from './math';

// src/index.ts
export * from './utils';
```

3. **Add tests**:

```typescript
// src/utils/math/add.spec.ts
import { describe, it, expect } from 'vitest';
import { add } from './add';

describe('add', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
```

## 🔧 Build Configuration

### esbuild Configuration

```typescript
// esbuild.build.ts
const sharedConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'neutral',
  sourcemap: true,
  external: [...dependencies, ...peerDependencies],
  tsconfig: './tsconfig.build.json',
  plugins: [esbuildPluginTsc()]
};

// ESM output
await esbuild.build({
  ...sharedConfig,
  outfile: 'dist/index.mjs',
  format: 'esm'
});

// CJS output
await esbuild.build({
  ...sharedConfig,
  outfile: 'dist/index.js',
  format: 'cjs'
});
```

### Type Declaration Bundling

Uses `dts-bundle-generator` to create single `.d.ts` file:

```typescript
// scripts/dtsBundlePlugin.ts
export function dtsBundlePlugin() {
  const entries = [
    {
      filePath: './src/index.ts',
      outFile: './dist/index.d.ts',
      output: {
        noBanner: true
      }
    }
  ];
  
  generateDtsBundle(entries);
}
```

### External Dependencies

Dependencies are automatically marked as external:

```typescript
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const dependencies = Object.keys(pkg.dependencies || {});
const peerDependencies = Object.keys(pkg.peerDependencies || {});
const externalDeps = [...dependencies, ...peerDependencies];
```

## 🧪 Testing

### Unit Tests

```typescript
// src/utils/demo/getDemoValue.spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from './getDemoValue';

describe('getDemoValue', () => {
  it('should return demo value', () => {
    const result = getDemoValue();
    expect(result).toBe('demo');
  });
});
```

### E2E Tests

```typescript
// test/app.e2e-spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from '@/utils';

describe('Library E2E', () => {
  it('should export utilities', () => {
    expect(getDemoValue).toBeDefined();
    expect(getDemoValue()).toBe('demo');
  });
});
```

### Coverage

```bash
pnpm vitest -- --coverage
```

## 📦 Publishing

### Prepare for Publishing

1. **Update package.json**:

```json
{
  "name": "@yourscope/library-name",
  "version": "1.0.0",
  "description": "Your library description",
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/library-name"
  }
}
```

2. **Build and test**:

```bash
pnpm build
pnpm test
```

3. **Version management**:

```bash
# Using standard-version
pnpm release

# Specific version
pnpm release -- --release-as 1.0.0

# Dry run
pnpm release -- --dry-run
```

### NPM Publishing

```bash
# Login to npm
npm login

# Publish public package
npm publish --access public

# Publish scoped package
npm publish
```

### Package Files

Control what gets published with `.npmignore` or `package.json` files field:

```json
{
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

## 🎯 Best Practices

### 1. Module Exports

Use named exports for better tree-shaking:

```typescript
// ✅ Good - Named exports
export function myFunction() { }
export class MyClass { }

// ❌ Avoid - Default exports
export default { myFunction, MyClass };
```

### 2. Type Definitions

Provide comprehensive types:

```typescript
// ✅ Good - Explicit types
export function calculate(a: number, b: number): number {
  return a + b;
}

// ❌ Avoid - Implicit any
export function calculate(a, b) {
  return a + b;
}
```

### 3. Side Effects

Mark side-effect-free code:

```json
{
  "sideEffects": false
}
```

### 4. Peer Dependencies

Use peer dependencies for framework libraries:

```json
{
  "peerDependencies": {
    "react": ">=16.8.0"
  }
}
```

## 📊 Performance Tips

- Keep bundle size small (analyze with `esbuild --metafile`)
- Use tree-shaking friendly patterns
- Avoid circular dependencies
- Mark framework dependencies as external
- Enable source maps for debugging

## 🔒 Security

- Keep dependencies updated
- Use `npm audit` regularly
- Review dependency licenses
- Avoid publishing secrets
- Use `.npmignore` properly

## 🤝 Contributing

Contributions welcome! Please:
- Add tests for new features
- Follow existing code style
- Update documentation
- Create meaningful commits

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)