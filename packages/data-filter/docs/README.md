# lib-tsdown - Documentation

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Core Features](#-core-features)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [tsdown Configuration](#-tsdown-configuration)
- [Testing](#-testing)
- [Publishing](#-publishing)
- [Best Practices](#-best-practices)

## 🎯 Project Overview

**lib-tsdown** is a modern TypeScript library template using tsdown, a zero-configuration bundler that combines the speed of esbuild with the power of Rollup's ecosystem. It's designed for developers who want fast builds without complex configuration.

### Why lib-tsdown?

- **Zero Config** - Works immediately with intelligent defaults
- **Blazing Fast** - Uses Oxc for extremely fast compilation
- **Modern Stack** - Built on latest TypeScript and tooling
- **Isolated Declarations** - Fast type generation with Oxc
- **Developer Friendly** - Minimal setup, maximum productivity

### Use Cases

- NPM packages and libraries
- Utility function collections
- Shared component libraries
- TypeScript SDKs
- Internal company packages

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10.24+

### Installation

```bash
# Create from template
degit royfw/rfjs/templates/libs/lib-tsdown my-library
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

### 1. tsdown Build System

Zero-config TypeScript bundler:

- **No Configuration** - Works out of the box
- **Fast Compilation** - Powered by Oxc
- **Dual Format** - ESM and CJS output
- **Tree Shaking** - Automatic optimization
- **Type Generation** - Fast declaration bundling

### 2. Oxc Integration

Modern JavaScript toolchain:

- **Fast Parsing** - Rust-based parser
- **Type Generation** - Isolated declarations support
- **Minification** - Built-in code compression
- **Source Maps** - Full debugging support

### 3. Simple Configuration

Minimal configuration needed:

```typescript
// tsdown.config.ts
export default defineConfig({
  entry: 'src/index.ts',
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: { oxc: true }
});
```

### 4. Development Workflow

Complete development setup:

- **Watch Mode** - Auto-rebuild on changes
- **Type Checking** - Parallel TypeScript validation
- **Quality Tools** - ESLint, Prettier, Husky
- **Testing** - Vitest integration

## 📁 Project Structure

```
lib-tsdown/
├── src/
│   ├── index.ts                    # Library entry
│   └── utils/
│       └── demo/
│           ├── getDemoValue.ts    # Example utility
│           ├── getExDemoValue.ts  # Extended utility
│           └── getExtraValue.ts   # Additional utility
├── dist/                          # Build output
│   ├── index.js                  # CJS bundle
│   ├── index.mjs                 # ESM bundle
│   └── index.d.ts                # Type declarations
├── tsdown.config.ts              # tsdown configuration
└── package.json
```

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev                # Watch mode with type checking
pnpm dev:tsdown         # tsdown watch only

# Build
pnpm build              # Production build
pnpm build:tsdown       # tsdown build
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
// src/utils/format/phone.ts
export function formatPhone(phone: string): string {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
}
```

2. **Export from index**:

```typescript
// src/utils/format/index.ts
export * from './phone';

// src/utils/index.ts
export * from './format';

// src/index.ts
export * from './utils';
```

3. **Add tests**:

```typescript
// src/utils/format/phone.spec.ts
import { describe, it, expect } from 'vitest';
import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('should format phone number', () => {
    expect(formatPhone('1234567890')).toBe('(123) 456-7890');
  });
});
```

## ⚙️ tsdown Configuration

### Basic Configuration

```typescript
// tsdown.config.ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  // Entry point
  entry: 'src/index.ts',
  
  // Output directory
  outDir: 'dist',
  
  // Output formats
  format: ['esm', 'cjs'],
  
  // Platform target
  platform: 'neutral',
  
  // ES target
  target: 'es2023',
  
  // Enable tree shaking
  treeshake: true,
  
  // Enable source maps
  sourcemap: true,
  
  // Clean output directory
  clean: true,
  
  // Generate type declarations with Oxc
  dts: {
    oxc: true
  }
});
```

### External Dependencies

```typescript
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const dependencies = Object.keys(pkg.dependencies || {});
const peerDependencies = Object.keys(pkg.peerDependencies || {});

export default defineConfig({
  external: [...dependencies, ...peerDependencies]
});
```

### Custom Plugins

```typescript
import { defineConfig } from 'tsdown';
import { myCustomPlugin } from './plugins/custom';

export default defineConfig({
  plugins: [
    myCustomPlugin()
  ]
});
```

## 🧪 Testing

### Unit Tests

```typescript
// src/utils/demo/getDemoValue.spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from './getDemoValue';

describe('getDemoValue', () => {
  it('should return demo value', () => {
    expect(getDemoValue()).toBe('demo');
  });
});
```

### E2E Tests

```typescript
// test/app.e2e-spec.ts
import { describe, it, expect } from 'vitest';
import * as lib from '../src';

describe('Library E2E', () => {
  it('should export all utilities', () => {
    expect(lib.getDemoValue).toBeDefined();
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

2. **Configure exports**:

```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

3. **Build and test**:

```bash
pnpm build
pnpm test
pnpm typecheck
```

### NPM Publishing

```bash
# Login to npm
npm login

# Publish
npm publish --access public
```

### Version Management

```bash
# Using standard-version
pnpm release

# Specific version
pnpm release -- --release-as 1.0.0

# Dry run
pnpm release -- --dry-run
```

## 🎯 Best Practices

### 1. Isolated Declarations

Enable for faster type generation:

```json
// tsconfig.json
{
  "compilerOptions": {
    "isolatedDeclarations": true
  }
}
```

### 2. Named Exports

Use named exports for better tree-shaking:

```typescript
// ✅ Good
export function myFunction() { }
export class MyClass { }

// ❌ Avoid
export default { myFunction, MyClass };
```

### 3. Side Effects

Mark side-effect-free code:

```json
{
  "sideEffects": false
}
```

### 4. Type Definitions

Provide comprehensive types:

```typescript
// ✅ Good
export function calculate(a: number, b: number): number {
  return a + b;
}

// ❌ Avoid
export function calculate(a, b) {
  return a + b;
}
```

## 📊 Performance Tips

- Enable Oxc for faster builds
- Use isolated declarations
- Keep bundle size small
- Avoid circular dependencies
- Mark dependencies as external

## 🔒 Security

- Keep dependencies updated
- Run `npm audit` regularly
- Review dependency licenses
- Use `.npmignore` properly
- Verify published packages

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