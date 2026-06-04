import _ from 'lodash';
import { aliasValue } from './aliasValue';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

export function aliasData<T>(
  aliasDataParam: ObjectData,
  source: ObjectData,
): T {
  // Work on a copy so the caller's input object is never mutated.
  const result = _.cloneDeep(aliasDataParam);
  const flattenAlias = flatten(result);
  for (const [key, value] of Object.entries(flattenAlias)) {
    if (!_.isString(value)) continue;
    const getAliasValue = aliasValue(value, source);
    if (_.isUndefined(getAliasValue)) continue;
    _.set(result, key, getAliasValue);
  }
  return result as T;
}
