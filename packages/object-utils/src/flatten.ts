export type ValueType = string | number | boolean | null | undefined | object | any[];

/**
 * convert nested object to flat object
 * @example
 * ```
 * const nestedObj =
 * {
 *  a: 1,
 *  b: {
 *      c: 10,
 *      d: 9
 *  }
 * }
 *
 * flatten(nestedObj)
 * result:
 * {
 *  a: 1,
 *  'b.c': 10,
 *  'b.d': 9
 * }
 * ```
 * @param nestedObj object
 * @param prefix optional
 * @returns
 */
export function flatten(nestedObj: object, prefix?: string) {
  return Object.entries(nestedObj).reduce((target, cur) => {
    const [key, value] = cur;
    const thisKey = prefix ? [prefix, key].join('.') : key;
    if (value === null || value === undefined || Array.isArray(value)) {
      Object.assign(target, { [`${thisKey}`]: value });
    } else if (typeof value === 'object') {
      Object.assign(target, flatten(value, thisKey));
    } else {
      Object.assign(target, { [`${thisKey}`]: value });
    }
    return target;
  }, <{[key:string]: ValueType}>{});
}
