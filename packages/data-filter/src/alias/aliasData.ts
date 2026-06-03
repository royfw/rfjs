import _ from 'lodash';
import { aliasValue } from './aliasValue';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

export function aliasData<T>(
  aliasDataParam: ObjectData,
  source: ObjectData,
): T {
  const flattenAlias = flatten(aliasDataParam);
  for (const [key, value] of Object.entries(flattenAlias)) {
    if (!_.isString(value)) continue;
    const getAliasValue = aliasValue(value, source);
    if (_.isUndefined(getAliasValue)) continue;
    _.set(aliasDataParam, key, getAliasValue);
  }
  return aliasDataParam as T;
}
