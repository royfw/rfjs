/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
/**
 * convert string[] keys to nested object
 * @example
 * ```
 * keys: ['a', 'b'], value: 10
 * return { a: { b: 10 } }
 * ```
 * @param keys key of string[]
 * @param value nested value
 * @returns nested object
 */
export function keysToNested(keys: string[], value: any, target: any = {}, depth = 0): any {
  const isLastDepth = depth == keys.length - 1;
  const key = keys[depth];
  if (!isLastDepth) {
    const result = keysToNested(keys, value, target[key], ++depth);
    target[key] = result;
  } else {
    target[key] = value;
  }
  return target;
}
