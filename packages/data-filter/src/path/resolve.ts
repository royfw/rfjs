import _ from 'lodash';
import type { PathResolveOptions } from '../types';

export function hasWildcardSyntax(path: string): boolean {
  return (
    path.includes('*') ||
    /\[[^\]]*,/.test(path) ||
    path.includes('..') ||
    /\[[^\]]*:/.test(path) ||
    /\[\?/.test(path)
  );
}

/**
 * Throw on path forms the removed jsonpath engine used to handle: wildcard
 * syntax, `$`-prefixed roots (which `_.get` would silently resolve to
 * undefined), and `[(...)]` script expressions.
 */
export function assertSupportedPath(path: string): void {
  if (hasWildcardSyntax(path) || path.startsWith('$') || /\[\(/.test(path)) {
    throw new Error(
      `[data-filter] unsupported path syntax '${path}': wildcard/jsonpath forms were removed — use dataType 'array'/'elemmatch', or an '=' expression`,
    );
  }
}

/**
 * Resolve a plain dot/bracket path with lodash `_.get`. A literal key that
 * contains a dot or comma still resolves when it exists directly on the object
 * (lodash checks the direct key first). With `fallbackOnEmpty: false`, a
 * missing path yields `null` instead of `undefined`.
 */
export function resolvePath(
  data: unknown,
  path: string,
  options: PathResolveOptions = {},
): unknown {
  const { fallbackOnEmpty = true } = options;
  assertSupportedPath(path);
  const value: unknown = _.get(data, path);
  return fallbackOnEmpty ? value : value ?? null;
}
