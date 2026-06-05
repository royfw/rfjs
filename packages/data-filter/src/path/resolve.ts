import _ from 'lodash';
import { JSONPath as JSONPathQuery } from 'jsonpath-plus';
import type { PathResolveOptions, PathResolveResult } from '../types';

function hasCommaOutsideBrackets(path: string): boolean {
  return path.includes(',') && !/\[[^\]]*,/.test(path);
}

function hasWildcardSyntax(path: string): boolean {
  return (
    path.includes('*') ||
    /\[[^\]]*,/.test(path) ||
    path.includes('..') ||
    /\[[^\]]*:/.test(path) ||
    /\[\?/.test(path)
  );
}

export function resolvePath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  path: string,
  options: PathResolveOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { fallbackToLodash = true, fallbackOnEmpty = true } = options;

  if (hasCommaOutsideBrackets(path)) {
    return _.get(data, path);
  }

  const hasWildcard = hasWildcardSyntax(path);

  try {
    const jsonPath = path.startsWith('$') ? path : `$.${path}`;
    const result = JSONPathQuery({
      path: jsonPath,
      json: data,
    });

    if (result.length === 0 && !hasWildcard && fallbackOnEmpty) {
      return _.get(data, path);
    }

    return hasWildcard ? result : result[0] ?? null;
  } catch (error) {
    if (fallbackToLodash) {
      return _.get(data, path);
    }
    throw error;
  }
}

export function resolvePathDetail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
  path: string,
  options: PathResolveOptions = {},
): PathResolveResult {
  const { fallbackToLodash = true, fallbackOnEmpty = true } = options;

  if (hasCommaOutsideBrackets(path)) {
    return {
      value: _.get(data, path),
      usedJsonPath: false,
      isWildcardResult: false,
    };
  }

  const hasWildcard = hasWildcardSyntax(path);

  try {
    const jsonPath = path.startsWith('$') ? path : `$.${path}`;
    const result = JSONPathQuery({
      path: jsonPath,
      json: data,
    });

    if (result.length === 0 && !hasWildcard && fallbackOnEmpty) {
      return {
        value: _.get(data, path),
        usedJsonPath: false,
        isWildcardResult: false,
      };
    }

    return {
      value: hasWildcard ? result : result[0] ?? null,
      usedJsonPath: true,
      isWildcardResult: hasWildcard,
    };
  } catch (error) {
    if (fallbackToLodash) {
      return {
        value: _.get(data, path),
        usedJsonPath: false,
        isWildcardResult: false,
      };
    }
    throw error;
  }
}
