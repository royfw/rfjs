import _ from 'lodash';
import { aliasValue, buildAliasLookup } from './aliasValue';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

export function aliasData<T>(
  aliasDataParam: ObjectData,
  source: ObjectData,
): T {
  // Work on a copy so the caller's input object is never mutated.
  const result = _.cloneDeep(aliasDataParam);
  const flattenAlias = flatten(result);
  // `source` is constant across the loop, so build its lookup table once.
  const lookup = buildAliasLookup(source);
  for (const [key, value] of Object.entries(flattenAlias)) {
    if (!_.isString(value)) continue;
    const getAliasValue = aliasValue(value, source, lookup);
    if (_.isUndefined(getAliasValue)) continue;
    _.set(result, key, getAliasValue);
  }
  return result as T;
}
