export function getByPath(obj: unknown, path: string): unknown {
  if (path === '') return obj;
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc != null && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}
