# fastify-esbuild - Documentation

## 📑 Table of Contents

- [Project Overview](#-project-overview)
- [Quick Start](#-quick-start)
- [Core Features](#-core-features)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Configuration](#-configuration)

## 🎯 Project Overview

**fastify-esbuild** is a production-ready Fastify application template built with esbuild for maximum performance. It combines Fastify's speed with esbuild's ultra-fast compilation to create high-performance REST APIs and microservices.

### Why fastify-esbuild?

- **Extreme Performance** - Fastify is one of the fastest Node.js frameworks
- **Lightning Builds** - esbuild provides 10-100x faster builds
- **Auto Documentation** - Built-in Swagger/OpenAPI integration
- **Production Ready** - Docker, testing, and deployment configured
- **Type Safe** - Full TypeScript support throughout

### Use Cases

- REST APIs and microservices
- Backend services for web/mobile apps
- API gateways
- Real-time data processing
- High-performance web services

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 10.24+

### Installation

```bash
# Clone or create from template
degit royfw/rfjs/templates/apps/fastify-esbuild my-api
cd my-api

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Start development server
pnpm dev
```

### First API Call

```bash
# Health check
curl http://localhost:3000/health

# View API documentation
open http://localhost:3000/docs
```

## ✨ Core Features

### 1. Fastify Framework

High-performance web framework with:

- **Fast Routing** - Optimized route matching
- **Schema Validation** - JSON Schema based validation
- **Plugin System** - Modular architecture
- **Lifecycle Hooks** - Request/response hooks
- **Logging** - Built-in Pino logger

### 2. Auto-Generated Documentation

Access Swagger UI at `/docs`:

- Interactive API testing
- Request/response examples
- Schema documentation
- Authentication testing

### 3. Pre-configured Plugins

Essential Fastify plugins included:

- `@fastify/cors` - CORS support
- `@fastify/swagger` - OpenAPI documentation
- `@fastify/swagger-ui` - Swagger UI
- `@fastify/sensible` - Sensible defaults
- `@fastify/multipart` - File uploads

### 4. Modular Architecture

Clean separation of concerns:

```
delivery/http/     # HTTP route modules
infrastructures/   # Core infrastructure
helpers/          # Utility functions
utils/            # Business utilities
```

## 📁 Project Structure

```
fastify-esbuild/
├── src/
│   ├── main.ts                           # Entry point
│   ├── configs.ts                        # Configuration
│   ├── delivery/http/                    # HTTP layer
│   │   ├── app/                         # App routes
│   │   │   ├── routes.ts               # Route definitions
│   │   │   ├── module.ts               # Route module
│   │   │   └── handlers/               # Request handlers
│   │   └── health/                      # Health routes
│   ├── infrastructures/                  # Core setup
│   │   ├── fastify/                     # Fastify config
│   │   │   ├── initialize-app.ts       # App initialization
│   │   │   └── registers/              # Plugin registration
│   │   └── server/                      # Server management
│   └── utils/                           # Utilities
├── test/                                 # Tests
├── docs/                                 # Documentation
└── docker/                               # Docker configs
```

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev              # esbuild watch + reload
pnpm dev:tsx          # Instant start with tsx
pnpm dev:esbuild      # esbuild watch only

# Build
pnpm build            # Production build
pnpm build:tsc        # TypeScript build

# Testing
pnpm test             # Run tests
pnpm test:e2e         # E2E tests
pnpm vitest:ui        # Test UI

# Code Quality
pnpm lint             # Lint code
pnpm typecheck        # Check types
```

### Creating New Routes

1. **Create Route Module**:

```typescript
// src/delivery/http/users/routes.ts
import type { FastifyInstance } from 'fastify';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users', {
    schema: {
      description: 'Get all users',
      tags: ['users'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    return [{ id: '1', name: 'John' }];
  });
}
```

2. **Register Module**:

```typescript
// src/delivery/http/users/module.ts
import { userRoutes } from './routes';

export const usersModule = {
  prefix: '/api/v1',
  routes: userRoutes
};
```

3. **Export Module**:

```typescript
// src/delivery/http/index.ts
export * from './users/module';
```

## 📚 API Documentation

### Swagger Configuration

Access auto-generated docs at `http://localhost:3000/docs`

Features:
- Interactive API testing
- Request/response schemas
- Authentication support
- Export OpenAPI spec

### Adding Documentation

Use JSON Schema in route definitions:

```typescript
fastify.post('/items', {
  schema: {
    description: 'Create new item',
    tags: ['items'],
    body: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        price: { type: 'number' }
      }
    },
    response: {
      201: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' }
        }
      }
    }
  }
}, async (request, reply) => {
  // Handler implementation
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
// test/health.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyServerManager } from '@/infrastructures';

describe('Health API', () => {
  let server: FastifyServerManager;

  beforeAll(async () => {
    server = new FastifyServerManager({ httpRouteModules: [] });
    await server.start();
  });

  afterAll(async () => {
    await server.close();
  });

  it('GET /health should return 200', async () => {
    const response = await server.app.inject({
      method: 'GET',
      url: '/health'
    });
    
    expect(response.statusCode).toBe(200);
  });
});
```

## 🚀 Deployment

### Docker Deployment

```bash
# Build image
docker build -t my-api .

# Run container
docker run -p 3000:3000 my-api

# Using docker-compose
docker-compose up -d
```

### Environment Variables

```env
# .env.production
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS
CORS_ORIGIN=https://yourdomain.com

# API
API_PREFIX=/api/v1
```

### Production Build

```bash
# Build
pnpm build

# Start
NODE_ENV=production node dist/main.js

# With PM2
pm2 start dist/main.js --name my-api
```

## ⚙️ Configuration

### Server Configuration

```typescript
// src/infrastructures/fastify/initialize-app.ts
export const initializeApp = (options?: FastifyServerOptions) => {
  const app = fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty'
      }
    },
    trustProxy: true,
    ...options
  });

  return app;
};
```

### CORS Setup

```typescript
// Register CORS plugin
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
});
```

### Custom Plugins

```typescript
// src/infrastructures/fastify/plugins/custom.ts
import fp from 'fastify-plugin';

export default fp(async (fastify) => {
  fastify.decorate('myCustomFunction', () => {
    return 'custom value';
  });
});
```

## 🔒 Security Best Practices

- Use environment variables for secrets
- Enable CORS appropriately
- Add rate limiting
- Validate all inputs
- Use HTTPS in production
- Keep dependencies updated

## 📊 Performance Tips

- Use schema validation (faster than manual)
- Enable HTTP/2 when possible
- Use connection pooling for databases
- Cache frequently accessed data
- Monitor with Fastify metrics

## 🤝 Contributing

Contributions welcome! Please follow the code style and add tests for new features.

## 📄 License

ISC

---

**Created with** [rfjs/templates](https://github.com/royfw/rfjs)