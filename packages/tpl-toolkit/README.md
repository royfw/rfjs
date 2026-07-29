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

> **Gotcha — exported Zod builders need an explicit `z.ZodType<T>` annotation under the tsdown
> `dts` output.** When a package built with `createTsdownConfig` exports a Zod schema whose type
> tsdown can't fully name — most commonly a **recursive** `z.lazy(...)` builder — dts emission can
> fail or emit an unusable type because it can't infer the schema's type from itself. Declare the
> shape as an `interface` first and annotate the export with an explicit `z.ZodType<T>`, rather than
> relying on inference:
>
> ```typescript
> interface Category {
>   name: string;
>   children: Category[];
> }
>
> // Explicit annotation — required so tsdown's dts output can name the type.
> export const categorySchema: z.ZodType<Category> = z.lazy(() =>
>   z.object({ name: z.string(), children: z.array(categorySchema) }),
> );
> ```
>
> This is a tsdown dts-build constraint, not a Zod one: the same pattern compiles without the
> annotation under other build paths (e.g. an app/lib whose types are emitted by `tsc`), so it's
> easy to miss until an external consumer copies the pattern into a tsdown-built package.

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
