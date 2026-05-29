# @rfjs/tpl-toolkit

Shared configuration factories and build helpers for rfjs project templates.

## Installation

```bash
npm install @rfjs/tpl-toolkit
```

## Usage

### `createTsdownConfig(type, options)`

Create a tsdown build configuration for different project types.

```typescript
import { createTsdownConfig } from '@rfjs/tpl-toolkit';

// Library config
const config = createTsdownConfig('lib');

// App config with custom options
const appConfig = createTsdownConfig('app', { entry: './src/main.ts' });
```

Config types: `'app' | 'lib' | 'bin' | 'orm' | 'bullmq'`

### `createVitestConfig(overrides)`

Create a Vitest test configuration with sensible defaults.

```typescript
import { createVitestConfig } from '@rfjs/tpl-toolkit/vitest';

export default createVitestConfig({
  coverage: { enabled: true },
});
```

### Lint-Staged Config

Pre-configured lint-staged setups for TypeScript projects.

```typescript
import { defaultLintStagedConfig } from '@rfjs/tpl-toolkit';
```

### Plugins

#### `copyFilesPlugin(options)`

tsdown plugin to copy files during build.

```typescript
import { copyFilesPlugin } from '@rfjs/tpl-toolkit/plugins';

copyFilesPlugin({ files: ['assets/**/*'] });
```

#### `tsdownDevNodemonPlugin(options)`

tsdown plugin for dev mode with nodemon auto-restart.

```typescript
import { tsdownDevNodemonPlugin } from '@rfjs/tpl-toolkit/plugins';

tsdownDevNodemonPlugin({ watch: ['src'] });
```
