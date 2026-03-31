# app-tsdown - Complete Documentation

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Core Features](#-core-features)
- [Architecture](#-architecture)
- [Development Guide](#-development-guide)
- [Available Scripts](#-available-scripts)
- [Configuration](#-configuration)
- [Testing](#-testing)
- [Build & Deployment](#-build--deployment)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Project Overview

### What is app-tsdown?

**app-tsdown** is a production-ready TypeScript application template built with [tsdown](https://tsdown.dev/), designed to provide an ultra-fast development experience with simplified configuration. This template serves as a solid foundation for building Node.js applications, CLI tools, backend services, and more.

### Why Choose app-tsdown?

- **Zero Configuration**: tsdown works out of the box with sensible defaults
- **Blazing Fast Builds**: Leverages esbuild internally for extreme speed
- **Modern Development Workflow**: Includes hot-reload, type-checking, and comprehensive testing
- **Production Ready**: Pre-configured with best practices and deployment tools
- **Developer Experience**: Integrated code quality tools, documentation, and Git workflows
- **Flexible**: Support for multiple build tools (tsdown/tsx/tsc) to suit different needs

### Use Cases

This template is ideal for:

- **Node.js Applications**: Backend services, APIs, microservices
- **CLI Tools**: Command-line utilities and automation scripts
- **Build Tools**: Development tooling and build pipelines
- **Prototypes**: Rapid application development and proof-of-concepts
- **Learning**: Understanding modern TypeScript project setups

## ✨ Core Features

### 1. Ultra-Fast Build System with tsdown

**tsdown** provides simplified building with extreme performance:

- **Zero Config**: No complex build configuration needed
- **Build Speed**: Millisecond-level compilation powered by esbuild
- **Watch Mode**: Instant rebuilds on file changes
- **Source Maps**: Full debugging support
- **Bundle Optimization**: Automatic tree-shaking and minification

Example build times (typical project):
- Initial build: ~30-50ms
- Incremental rebuild: ~10-20ms

### 2. Multiple Build Options

Choose the build tool that fits your workflow:

```bash
# tsdown (fastest, zero-config, recommended)
pnpm dev:tsdown

# tsx (instant startup, no build step)
pnpm dev:tsx

# TypeScript compiler (traditional approach)
pnpm dev:tsc
```

### 3. Comprehensive Testing

**Vitest** provides a fast and modern testing experience:

- **Unit Tests**: Test individual functions and modules
- **E2E Tests**: Test complete application workflows
- **Coverage Reports**: Istanbul coverage integration
- **UI Mode**: Visual test explorer

### 4. Code Quality Automation

Pre-configured quality tools ensure consistent code:

- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **Husky**: Git hooks automation
- **lint-staged**: Pre-commit validation

### 5. Documentation Site

Built-in VitePress documentation:

```bash
pnpm docs:dev    # Start docs server
pnpm docs:build  # Build static docs
```

### 6. Environment Management

**dotenv-flow** for environment-specific configuration:

```
.env.example      # Template
.env.local        # Local development (gitignored)
.env.development  # Development environment
.env.production   # Production environment
```

## 🏗️ Architecture

### Technology Stack

```mermaid
graph TB
    A[TypeScript Source] --> B[tsdown]
    B --> C[JavaScript Output]
    C --> D[Node.js Runtime]
    
    A --> E[Type Checker]
    E --> F[Validation]
    
    A --> G[ESLint]
    G --> F
    
    A --> H[Vitest]
    H --> I[Test Results]
```

### Project Structure

```
app-tsdown/
├── src/                          # Source code
│   ├── main.ts                  # Application entry point
│   ├── configs.ts               # Configuration loader
│   └── utils/                   # Utility modules
│       ├── index.ts            # Barrel export
│       └── demo/               # Demo utilities
│
├── docs/                        # VitePress documentation
│   ├── README.md               # Documentation home
│   └── README.zh-TW.md         # Chinese documentation
│
├── tsconfig.json               # Base TypeScript config
├── tsconfig.app.json           # Application config
├── tsconfig.build.json         # Build config
├── tsconfig.spec.json          # Test config
│
├── vitest.config.mts           # Unit test config
├── vitest.config.e2e.mts       # E2E test config
├── eslint.config.mjs           # ESLint config
│
├── .env.example                # Environment template
├── .nvmrc                      # Node version
├── .prettierrc                 # Prettier config
├── commitlint.config.js        # Commit lint config
│
└── package.json                # Project manifest
```

### Module Architecture

The project follows a clean architecture pattern:

1. **Entry Point** (`main.ts`): Application bootstrap
2. **Configuration** (`configs.ts`): Centralized config management
3. **Utilities** (`utils/`): Reusable functions and helpers
4. **Tests**: Co-located with source or in dedicated test directory

### Build Process

```mermaid
graph LR
    A[TypeScript] --> B{Build Tool}
    B -->|tsdown| C[Fast Bundle]
    B -->|tsx| D[Direct Execution]
    B -->|tsc| E[Type-Safe Output]
    
    C --> F[dist/main.js]
    D --> G[No Build]
    E --> F
```

## 🛠️ Development Guide

### Environment Setup

#### Prerequisites

1. **Install Node.js**:
   ```bash
   # Using nvm (recommended)
   nvm install 18
   nvm use 18
   
   # Or download from nodejs.org
   ```

2. **Install pnpm**:
   ```bash
   npm install -g pnpm@10.24.0
   ```

3. **Verify Installation**:
   ```bash
   node --version  # Should be >=18
   pnpm --version  # Should be >=10.24.0
   ```

#### Project Setup

1. **Clone or Create Project**:
   ```bash
   # If using as template
   degit royfw/rfjs/templates/apps/app-tsdown my-app
   cd my-app
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your settings
   ```

4. **Verify Setup**:
   ```bash
   pnpm typecheck  # Check TypeScript
   pnpm lint       # Check code style
   pnpm test       # Run tests
   ```

### Development Workflow

#### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/my-feature

# Start development server
pnpm dev

# Make changes to src/
# Tests run automatically on save

# Run type checking
pnpm typecheck:watch
```

#### 2. Writing Code

Follow TypeScript best practices:

```typescript
// src/utils/myFeature.ts

/**
 * Calculate the sum of two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}
```

#### 3. Writing Tests

Create co-located test files:

```typescript
// src/utils/myFeature.spec.ts

import { describe, it, expect } from 'vitest';
import { add } from './myFeature';

describe('add', () => {
  it('should add two numbers correctly', () => {
    expect(add(2, 3)).toBe(5);
  });
  
  it('should handle negative numbers', () => {
    expect(add(-1, 1)).toBe(0);
  });
});
```

#### 4. Committing Changes

```bash
# Stage changes
git add .

# Commit using Commitizen (enforces conventional commits)
pnpm commit

# Or manual commit (must follow conventional format)
git commit -m "feat: add new feature"
```

### Code Standards

#### TypeScript Configuration

The project uses strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

#### ESLint Rules

Key linting rules:

- No unused variables
- Consistent type imports
- Prefer const over let
- No explicit any (use unknown instead)

#### Prettier Formatting

Automatic formatting on save:

- 2 spaces indentation
- Single quotes
- Trailing commas
- Unix line endings

### Git Workflow

#### Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Production hotfixes

#### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user authentication
fix: resolve database connection issue
docs: update API documentation
style: format code with prettier
refactor: simplify error handling
test: add unit tests for auth module
chore: update dependencies
```

## 📜 Available Scripts

### Development Scripts

#### `pnpm dev`

Start development mode with tsdown watch and type-checking:

```bash
pnpm dev
```

Features:
- Automatic rebuild on file changes
- Type-checking in parallel
- Source maps enabled
- Nodemon auto-restart

#### `pnpm dev:tsx`

Use tsx for instant startup (no build step):

```bash
pnpm dev:tsx
```

Best for:
- Quick testing
- Debugging
- REPL-style development

#### `pnpm dev:tsdown`

Pure tsdown watch mode:

```bash
pnpm dev:tsdown
```

Most performant option for active development.

#### `pnpm tsx`

Run TypeScript directly:

```bash
pnpm tsx

# Or with arguments
npx tsx src/main.ts --port 3000
```

### Build Scripts

#### `pnpm build`

Production build with tsdown:

```bash
pnpm build
```

Output:
- Optimized JavaScript in `dist/`
- Source maps for debugging
- Minified code

#### `pnpm build:tsc`

Build with TypeScript compiler:

```bash
pnpm build:tsc
```

Use when:
- Maximum compatibility needed
- Debugging build issues
- Generating declaration files

#### `pnpm clean`

Remove build artifacts:

```bash
pnpm clean
```

### Testing Scripts

#### `pnpm test`

Run all unit tests:

```bash
pnpm test

# With coverage
pnpm vitest:run --coverage
```

#### `pnpm test:e2e`

Run end-to-end tests:

```bash
pnpm test:e2e
```

#### `pnpm vitest:ui`

Launch Vitest UI:

```bash
pnpm vitest:ui
```

Interactive test explorer with:
- Visual test results
- Coverage visualization
- Performance metrics

### Code Quality Scripts

#### `pnpm lint`

Check code style:

```bash
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

#### `pnpm typecheck`

Verify TypeScript types:

```bash
pnpm typecheck

# Watch mode
pnpm typecheck:watch
```

### Documentation Scripts

#### `pnpm docs:dev`

Start documentation server:

```bash
pnpm docs:dev
# Opens at http://localhost:5173
```

#### `pnpm docs:build`

Build static documentation:

```bash
pnpm docs:build
# Output in docs/.vitepress/dist
```

## ⚙️ Configuration

### TypeScript Configuration

#### Base Config (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "outDir": "./dist",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Key settings explained:

- **target: ES2023**: Use modern JavaScript features
- **module: ESNext**: Latest module system
- **moduleResolution: bundler**: Optimized for bundlers
- **strict: true**: Maximum type safety
- **paths**: Path aliases (@ = src/)

#### Build Config (`tsconfig.build.json`)

Extends base config for production builds:
- Excludes test files
- Enables declaration generation (if needed)

#### Test Config (`tsconfig.spec.json`)

Includes test utilities and types:
- Vitest types
- Test helpers

### tsdown Configuration

tsdown uses zero-configuration by default. For custom configuration, create `tsdown.config.ts`:

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs', 'esm'],
  clean: true,
  sourcemap: true,
});
```

### Vitest Configuration

#### Unit Tests (`vitest.config.mts`)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

#### E2E Tests (`vitest.config.e2e.mts`)

Separate configuration for integration tests.

### ESLint Configuration

Modern flat config format (`eslint.config.mjs`):

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Custom rules
    },
  }
);
```

### Environment Variables

Using **dotenv-flow** for environment-specific configs:

```typescript
// src/configs.ts
import dotenvFlow from 'dotenv-flow';

dotenvFlow.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Add your config here
};
```

Environment files priority:
1. `.env.local` (highest priority, gitignored)
2. `.env.{NODE_ENV}`
3. `.env`

## 🧪 Testing

### Testing Strategy

#### Test Pyramid

```
      /\
     /E2E\       <- Few, high-level
    /------\
   /  Int   \    <- Some, mid-level  
  /----------\
 /   Unit     \  <- Many, low-level
/--------------\
```

- **Unit Tests**: 70% - Test individual functions
- **Integration Tests**: 20% - Test module interactions
- **E2E Tests**: 10% - Test complete workflows

### Writing Unit Tests

Example unit test:

```typescript
// src/utils/demo/getDemoValue.spec.ts
import { describe, it, expect } from 'vitest';
import { getDemoValue } from './getDemoValue';

describe('getDemoValue', () => {
  it('should return demo value', () => {
    const result = getDemoValue();
    expect(result).toBe('demo');
  });

  it('should handle edge cases', () => {
    // Test edge cases
  });
});
```

### Writing E2E Tests

Example E2E test:

```typescript
// test/app.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Application E2E', () => {
  beforeAll(async () => {
    // Setup
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should start successfully', async () => {
    // Test application startup
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm vitest run src/utils/demo/getDemoValue.spec.ts

# Run tests matching pattern
pnpm vitest run --grep "should handle"

# Run with coverage
pnpm vitest run --coverage

# Watch mode
pnpm vitest
```

### Test Coverage

View coverage reports:

```bash
pnpm vitest run --coverage
# Opens HTML report in coverage/index.html
```

Coverage goals:
- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

## 🚀 Build & Deployment

### Building for Production

#### Standard Build

```bash
# Clean previous builds
pnpm clean

# Build with tsdown
pnpm build

# Verify build
node dist/main.js
```

#### TypeScript Build

For maximum compatibility:

```bash
pnpm build:tsc
```

### Deployment Platforms

#### Node.js Servers

```bash
# Install dependencies
pnpm install --prod

# Build
pnpm build

# Run with PM2
pm2 start dist/main.js --name app-tsdown
```

#### Serverless (AWS Lambda, etc.)

tsdown automatically optimizes for serverless environments:
- Single file bundle
- Minified output
- Tree-shaking enabled

#### Container Platforms (Docker, Kubernetes)

Example Dockerfile:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm@10.24.0
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

CMD ["node", "dist/main.js"]
```

### Performance Optimization

#### Build Optimization

tsdown automatically optimizes builds with:
- Minification
- Tree-shaking
- Code splitting (when configured)

#### Runtime Optimization

1. **Use Production Node**:
   ```bash
   NODE_ENV=production node dist/main.js
   ```

2. **Enable Clustering**:
   ```typescript
   import cluster from 'cluster';
   import os from 'os';
   
   if (cluster.isPrimary) {
     for (let i = 0; i < os.cpus().length; i++) {
       cluster.fork();
     }
   } else {
     // Start application
   }
   ```

## 💡 Best Practices

### Code Organization

#### 1. Module Structure

```typescript
// Good: Clear separation of concerns
src/
├── features/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   └── auth.spec.ts
│   └── users/
│       ├── users.service.ts
│       └── users.spec.ts
└── shared/
    └── utils/
```

#### 2. Barrel Exports

```typescript
// src/utils/index.ts
export * from './demo';
export * from './validation';
export * from './formatting';
```

### TypeScript Best Practices

#### 1. Avoid `any`

```typescript
// Bad
function process(data: any) { }

// Good
function process(data: unknown) {
  if (typeof data === 'string') {
    // Type narrowing
  }
}
```

#### 2. Use Const Assertions

```typescript
// Infer literal types
const config = {
  api: 'https://api.example.com',
  timeout: 5000,
} as const;
```

#### 3. Prefer Interfaces for Objects

```typescript
// Good for extensibility
interface User {
  id: string;
  name: string;
}

// Good for unions
type Status = 'pending' | 'active' | 'inactive';
```

### Error Handling

#### 1. Custom Error Classes

```typescript
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
```

#### 2. Centralized Error Handler

```typescript
process.on('unhandledRejection', (error: Error) => {
  console.error('Unhandled Rejection:', error);
  process.exit(1);
});
```

### Performance Tips

#### 1. Lazy Loading

```typescript
// Load heavy modules only when needed
const heavyModule = await import('./heavy-module');
```

#### 2. Caching

```typescript
const cache = new Map();

function expensiveOperation(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  const result = /* expensive computation */;
  cache.set(key, result);
  return result;
}
```

## 🐛 Troubleshooting

### Common Issues

#### Build Errors

**Issue**: `Cannot find module '@/utils'`

**Solution**: Check path aliases in `tsconfig.json`:
```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

tsdown automatically resolves path aliases.

---

**Issue**: `tsdown: Build failed`

**Solution**: Check tsdown configuration and ensure all dependencies are installed.

#### Type Errors

**Issue**: `Type 'X' is not assignable to type 'Y'`

**Solution**: 
1. Run `pnpm typecheck` to see full error context
2. Check TypeScript version compatibility
3. Verify `tsconfig.json` settings

#### Test Failures

**Issue**: Tests pass locally but fail in CI

**Solution**:
1. Check environment variables
2. Ensure deterministic test data
3. Use `--no-threads` flag in CI

#### Runtime Errors

**Issue**: `MODULE_NOT_FOUND` in production

**Solution**:
1. Verify all dependencies are in `dependencies` (not `devDependencies`)
2. Check bundle configuration
3. Use `pnpm install --prod` for production

### Debug Mode

Enable detailed logging:

```bash
# Node.js debugging
NODE_ENV=development DEBUG=* node dist/main.js

# Source map debugging
node --enable-source-maps dist/main.js
```

### Getting Help

- Check [GitHub Issues](https://github.com/royfw/rfjs/issues)
- Review [tsdown documentation](https://tsdown.dev/)
- Ask in project discussions

## 🤝 Contributing

### Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run tests: `pnpm test`
6. Commit: `pnpm commit`
7. Push and create a Pull Request

### Code Review Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and well-described

## 📄 License

This project is licensed under the ISC License.

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)

For more templates, check out the [template collection](https://github.com/royfw/rfjs/tree/main/templates).