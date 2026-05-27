import { flatten } from './flatten';

/**
 * convert nested object to flat string
 * @example
 * ```
 * const obj = { a: { b: 10 }, b: 'abc' }
 * result: 'a.b: 10, b: abc'
 * ```
 * @param obj object
 * @returns flat object string
 */
export function toFlatString(obj: object) {
  return Object.entries(flatten(obj))
    .reduce(
      (pre, cur) => {
        const [key, value] = cur;
        pre.push(`${key}: ${value}`);
        return pre;
      },
      <string[]>[],
    )
    .join(', ');
}
