/**
 * Read a value from `obj` by a dot/bracket path, e.g. `'a.b[0].c'`.
 * Returns `undefined` for a missing path, a nullish intermediate, or a non-object
 * input. Paths are parsed as nested access — a literal key containing `.` is NOT
 * supported (matching the common `_.get` convention).
 */
export function getByPath(obj: unknown, path: string): unknown {
  const keys = path
    .replace(/\[(\w+)\]/g, '.$1')
    .split('.')
    .filter((k) => k.length > 0);
  if (keys.length === 0) return undefined;
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
