/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
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
      (pre: string[], cur: [string, any]) => {
        const [key, value] = cur;
        pre.push(`${key}: ${String(value)}`);
        return pre;
      },
      [],
    )
    .join(', ');
}
