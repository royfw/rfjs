/** True only for non-null, non-array, non-Date objects (a plain record). */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

/** Strict structural equality. Dates compare by time; NaN is not equal to NaN. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      ),
  );
}

/**
 * Recursive containment (the in-memory analogue of Postgres `@>`): every key in
 * `value` must exist in `target`; plain-object values recurse, everything else
 * (incl. arrays) is compared by strict `deepEqual`.
 */
export function contains(target: unknown, value: unknown): boolean {
  if (isPlainObject(value)) {
    if (!isPlainObject(target)) return false;
    return Object.keys(value).every(
      (key) =>
        Object.prototype.hasOwnProperty.call(target, key) &&
        contains(target[key], value[key]),
    );
  }
  return deepEqual(target, value);
}
