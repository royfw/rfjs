export * from './types';
export * from './schema';
export * from './derive';

// Re-exported for consumers that only want to import from `@rfjs/table-builder` (spec §4.2).
export { resolveLabel, getByPath } from '@rfjs/data-schema';
export type { ScalarType, LocalizedLabel, FieldFormat, FieldOption, DataResourceMeta, DataFieldMeta } from '@rfjs/data-schema';
