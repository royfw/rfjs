# lib-rollup - Documentation

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Core Features](#-core-features)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Rollup Configuration](#-rollup-configuration)
- [Plugin Ecosystem](#-plugin-ecosystem)
- [Testing](#-testing)
- [Publishing](#-publishing)
- [Best Practices](#-best-practices)

## 🎯 Project Overview

**lib-rollup** is a production-ready TypeScript library template using Rollup, the de facto standard for JavaScript library bundling. Rollup excels at creating optimized, tree-shakeable packages that work seamlessly across different module systems.

### Why lib-rollup?

- **Industry Standard** - Used by React, Vue, Three.js, and countless other libraries
- **Optimal Tree-Shaking** - Best-in-class dead code elimination
- **Plugin Ecosystem** - Hundreds of official and community plugins
- **ESM-First** - Modern ES module support with CJS compatibility
- **Flexible Configuration** - Powerful configuration options for complex builds

### Use Cases

- NPM packages and libraries
- Framework plugins and extensions
- UI component libraries
- JavaScript SDKs
- Shared utility packages

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10.24+

### Installation

```bash
# Create from template
degit royfw/rfjs/templates/libs/lib-rollup my-library
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

### 1. Rollup Build System

Industry-standard bundler for libraries:

- **Tree Shaking** - Advanced dead code elimination
- **Code Splitting** - Automatic chunk optimization
- **Plugin System** - Extensible build pipeline
- **Multiple Formats** - ESM, CJS, UMD, IIFE support
- **Source Maps** - Full debugging support

### 2. Official Plugins Included

Essential Rollup plugins pre-configured:

- `@rollup/plugin-node-resolve` - Resolve node_modules
- `@rollup/plugin-commonjs` - Convert CJS to ESM
- `@rollup/plugin-json` - Import JSON files
- `@rollup/plugin-terser` - Minification
- `rollup-plugin-typescript2` - TypeScript compilation
- `rollup-plugin-dts` - Type declaration bundling

### 3. TypeScript Integration

Full TypeScript support:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "strict": true
  }
}
```

### 4. Development Workflow

Complete development setup:

- **Watch Mode** - Automatic rebuilds on file changes
- **Type Checking** - Parallel TypeScript checking
- **Hot Reload** - Fast iteration cycle
- **Quality Tools** - ESLint, Prettier, Husky

## 📁 Project Structure

```
lib-rollup/
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
├── rollup.config.ts              # Rollup configuration
└── package.json
```

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev                # Watch mode with type checking
pnpm dev:rollup         # Rollup watch only

# Build
pnpm build              # Production build
pnpm build:rollup       # Rollup build
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
// src/utils/string/capitalize.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
```

2. **Export from index**:

```typescript
// src/utils/string/index.ts
export * from './capitalize';

// src/utils/index.ts
export * from './string';

// src/index.ts
export * from './utils';
```

3. **Add tests**:

```typescript
// src/utils/string/capitalize.spec.ts
import { describe, it, expect } from 'vitest';
import { capitalize } from './capitalize';

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });
});
```

## 🔧 Rollup Configuration

### Basic Configuration

```typescript
// rollup.config.ts
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  // JavaScript bundles
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/index.mjs',
        format: 'esm',
        sourcemap: true
      }
    ],
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.lib.json'
      }),
      terser()
    ],
    external: ['tslib']
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
```

### External Dependencies

Mark dependencies as external to avoid bundling:

```typescript
import pkg from './package.json';

export default {
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ]
};
```

### Output Options

Multiple output formats:

```typescript
output: [
  { file: 'dist/index.js', format: 'cjs' },      // CommonJS
  { file: 'dist/index.mjs', format: 'esm' },     // ES Module
  { file: 'dist/index.umd.js', format: 'umd' }   // UMD
]
```

## 🔌 Plugin Ecosystem

### Commonly Used Plugins

**Node Resolution:**
```typescript
import resolve from '@rollup/plugin-node-resolve';

plugins: [
  resolve({
    preferBuiltins: true,
    extensions: ['.ts', '.js']
  })
]
```

**CommonJS Conversion:**
```typescript
import commonjs from '@rollup/plugin-commonjs';

plugins: [
  commonjs({
    include: 'node_modules/**'
  })
]
```

**Minification:**
```typescript
import terser from '@rollup/plugin-terser';

plugins: [
  terser({
    compress: {
      drop_console: true
    }
  })
]
```

**JSON Import:**
```typescript
import json from '@rollup/plugin-json';

plugins: [json()]
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
  },
  "keywords": ["library", "typescript", "rollup"]
}
```

2. **Configure package exports**:

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

# With tag
npm publish --tag beta
```

### Version Management

Using Commitizen:

```bash
# Make changes
git add .
pnpm commit

# Release
npx standard-version
git push --follow-tags
```

## 🎯 Best Practices

### 1. Tree-Shakeable Exports

Use named exports for optimal tree-shaking:

```typescript
// ✅ Good - Tree-shakeable
export function add(a: number, b: number) { return a + b; }
export function subtract(a: number, b: number) { return a - b; }

// ❌ Avoid - Not tree-shakeable
export default {
  add: (a: number, b: number) => a + b,
  subtract: (a: number, b: number) => a - b
};
```

### 2. Side Effect Management

Mark side-effect-free packages:

```json
{
  "sideEffects": false
}
```

Or specify files with side effects:

```json
{
  "sideEffects": ["*.css", "src/polyfills.ts"]
}
```

### 3. Peer Dependencies

Use for framework libraries:

```json
{
  "peerDependencies": {
    "react": ">=16.8.0"
  },
  "peerDependenciesMeta": {
    "react": {
      "optional": true
    }
  }
}
```

### 4. Bundle Analysis

Analyze bundle size:

```bash
# Using rollup-plugin-visualizer
pnpm add -D rollup-plugin-visualizer
```

```typescript
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  visualizer({
    filename: 'bundle-analysis.html',
    open: true
  })
]
```

## 📊 Performance Tips

- Use `@rollup/plugin-terser` for minification
- Enable tree-shaking with ESM output
- Mark external dependencies properly
- Avoid circular dependencies
- Use code splitting for large libraries
- Generate source maps for debugging

## 🔒 Security

- Keep dependencies updated with `pnpm update`
- Run `npm audit` regularly
- Review dependency licenses
- Use `.npmignore` to exclude sensitive files
- Verify published package contents

## 🤝 Contributing

Contributions welcome! Please:
- Add tests for new features
- Follow existing code style
- Update documentation
- Create meaningful commit messages

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)