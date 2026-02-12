# koa-esbuild Documentation

A production-ready Koa application template built with esbuild for building high-performance REST APIs, microservices, and web services.

## Overview

This template provides a complete foundation for building TypeScript-based web applications using:

- **Koa** - Lightweight and flexible Node.js web framework
- **esbuild** - Extremely fast JavaScript bundler and build tool
- **routing-controllers** - Decorator-based routing with automatic OpenAPI generation
- **tsyringe** - Dependency injection container
- **Vitest** - Modern testing framework

## Features

### Core Features

- ⚡ **Lightning Fast Development**
  - esbuild provides 10-100x faster builds
  - Hot reload with nodemon
  - TypeScript type checking in parallel

- 🎯 **Decorator-based Routing**
  - Clean controller syntax with routing-controllers
  - Automatic request validation
  - Built-in error handling

- 📚 **Auto-generated Documentation**
  - Swagger UI at `/docs`
  - OpenAPI 3.0 specification
  - Automatic schema generation from TypeScript types

- 💉 **Dependency Injection**
  - IoC container with tsyringe
  - Easy service management
  - Testable architecture

- 🧪 **Comprehensive Testing**
  - Unit tests with Vitest
  - E2E tests with supertest
  - Coverage reports
  - UI test runner

- 🔍 **Code Quality**
  - ESLint with TypeScript support
  - Prettier for code formatting
  - Git hooks with husky
  - Commitizen for conventional commits

## Getting Started

### Prerequisites

- Node.js 18 or higher
- pnpm 10.24.0 or higher

### Installation

```bash
# Clone or copy the template
cd koa-esbuild

# Install dependencies
pnpm install
```

### Development

```bash
# Start development server with auto-reload
pnpm dev

# The server will start at http://localhost:3000
# Swagger UI available at http://localhost:3000/docs
```

### Building

```bash
# Build for production
pnpm build

# Output will be in ./dist directory
```

### Running in Production

```bash
# After building
pnpm start

# Or use Node directly
node dist/main.js
```

## Project Structure

```
koa-esbuild/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── koaApp.ts                 # Koa application setup
│   ├── server.ts                 # Server configuration
│   ├── configs.ts                # Environment configuration
│   ├── ioc/                      # Dependency injection
│   │   └── iocAdapter.ts         # IoC container adapter
│   └── utils/                    # Utility modules
│       ├── index.ts
│       ├── demo/                 # Demo utilities
│       └── time/                 # Time utilities
├── test/                         # E2E test files
├── docs/                         # VitePress documentation
├── esbuild.build.mjs            # Production build config
├── esbuild.dev.mjs              # Development build config
└── vitest.config.mts            # Vitest configuration
```

## Configuration

### Environment Variables

Create a `.env.local` file based on `.env.example`:

```env
# Server
PORT=3000
NODE_ENV=local

# Add your custom environment variables
```

### TypeScript Configuration

The template includes multiple tsconfig files:

- `tsconfig.json` - Base configuration
- `tsconfig.app.json` - Application code
- `tsconfig.build.json` - Build configuration
- `tsconfig.spec.json` - Test configuration

## Creating Controllers

Use routing-controllers decorators to create clean APIs:

```typescript
import { JsonController, Get, Post, Body } from 'routing-controllers';
import { injectable } from 'tsyringe';

@injectable()
@JsonController('/api/users')
export class UserController {
  @Get()
  async getAll() {
    return { users: [] };
  }

  @Post()
  async create(@Body() user: CreateUserDto) {
    return { user };
  }
}
```

## Dependency Injection

Register and inject services using tsyringe:

```typescript
import { injectable, inject } from 'tsyringe';

@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private userRepo: UserRepository
  ) {}
  
  async findAll() {
    return this.userRepo.find();
  }
}
```

## Testing

### Unit Tests

```bash
# Run tests
pnpm test

# Watch mode
pnpm vitest

# UI mode
pnpm vitest:ui

# Coverage
pnpm vitest:run --coverage
```

### E2E Tests

```bash
# Run E2E tests
pnpm test:e2e

# With UI
pnpm vitest:e2e:ui
```

Example E2E test:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

describe('API E2E', () => {
  beforeAll(async () => {
    // Setup
  });

  it('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
});
```

## Build Configurations

### Development Build (esbuild.dev.mjs)

- Watch mode enabled
- Source maps included
- Fast rebuilds
- Nodemon integration

### Production Build (esbuild.build.mjs)

- Optimized bundle
- Tree shaking
- Minification
- No source maps

## Development Workflow

### Available Scripts

```bash
# Development
pnpm dev                  # esbuild watch + type checking + auto-reload
pnpm dev:esbuild         # esbuild watch only
pnpm start               # Run built application

# Building
pnpm build               # Production build with esbuild
pnpm build:tsc           # TypeScript compiler build
pnpm clean               # Clean dist directory

# Testing
pnpm test                # Run unit tests
pnpm test:e2e            # Run E2E tests
pnpm vitest              # Watch mode
pnpm vitest:ui           # UI test runner
pnpm vitest:e2e          # E2E watch mode
pnpm vitest:e2e:ui       # E2E UI runner

# Code Quality
pnpm lint                # Run ESLint
pnpm lint:fix            # Fix ESLint issues
pnpm typecheck           # Type check without emit
pnpm typecheck:watch     # Watch type checking

# Git & Release
pnpm commit              # Commitizen commit
pnpm release             # Create release with standard-version

# Documentation
pnpm docs:dev            # Start VitePress dev server
pnpm docs:build          # Build documentation
pnpm docs:preview        # Preview built docs
```

### Git Workflow

1. Make changes to your code
2. Stage changes: `git add .`
3. Commit with Commitizen: `pnpm commit`
4. Push changes

The template includes:
- Pre-commit hooks (lint-staged)
- Commit message linting
- Automated testing before commits

## Middleware

Koa uses a cascading middleware system:

```typescript
import Koa from 'koa';
import bodyParser from '@koa/bodyparser';
import cors from '@koa/cors';
import logger from 'koa-logger';

const app = new Koa();

// Middleware stack
app.use(logger());
app.use(cors());
app.use(bodyParser());

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.status = err.status || 500;
    ctx.body = { error: err.message };
  }
});
```

## OpenAPI/Swagger

Access the Swagger UI at `http://localhost:3000/docs` to:
- View all API endpoints
- Test endpoints interactively
- See request/response schemas
- Download OpenAPI specification

## Logging

The template includes Winston for structured logging:

```typescript
import logger from './logger';

logger.info('Application started');
logger.error('Error occurred', { error });
logger.debug('Debug information', { data });
```

## Best Practices

1. **Project Organization**
   - Keep controllers thin, move logic to services
   - Use dependency injection for testability
   - Organize by feature/module

2. **Error Handling**
   - Use custom error classes
   - Centralized error handling middleware
   - Proper HTTP status codes

3. **Validation**
   - Use class-validator decorators
   - Validate at controller level
   - Return meaningful error messages

4. **Testing**
   - Write tests alongside code
   - Aim for high coverage on business logic
   - Use E2E tests for critical flows

5. **Type Safety**
   - Enable strict mode in tsconfig
   - Avoid `any` types
   - Use interfaces for data structures

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Koa 3.0+
- **Language**: TypeScript 5.7+
- **Build Tool**: esbuild 0.25+
- **Testing**: Vitest 3.2+
- **Validation**: class-validator 0.14+
- **DI Container**: tsyringe 4.10+
- **Documentation**: VitePress 1.6+
- **Package Manager**: pnpm 10.24+

## Troubleshooting

### Common Issues

**Port already in use**
```bash
# Change PORT in .env.local
PORT=3001
```

**Type checking errors**
```bash
# Run type checking separately
pnpm typecheck
```

**Build failures**
```bash
# Clean and rebuild
pnpm clean
pnpm build
```

## Additional Resources

- [Koa Documentation](https://koajs.com/)
- [esbuild Documentation](https://esbuild.github.io/)
- [routing-controllers](https://github.com/typestack/routing-controllers)
- [tsyringe](https://github.com/microsoft/tsyringe)
- [Vitest Documentation](https://vitest.dev/)

## License

ISC

---

**Part of** [rfjs/templates](https://github.com/royfw/rfjs)