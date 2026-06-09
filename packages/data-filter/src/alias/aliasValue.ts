import _ from 'lodash';
import { aliasRegex } from './aliasRegex';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

/** Precompute the `{ ...source, ...flatten(source) }` lookup once per call. */
export const buildAliasLookup = (data: ObjectData): ObjectData => ({
  ...data,
  ...flatten(data),
});

export const aliasValue = (
  alias: string,
  data: ObjectData,
  lookup?: ObjectData,
): any => {
  const matchAll = alias.matchAll(aliasRegex);
  const aliasData: ObjectData = lookup ?? buildAliasLookup(data);
  let aliasValue = undefined;
  for (const regex of matchAll) {
    const key = regex[1] || regex[2];
    const flattenValue = aliasData[key];
    const _value = _.get(data, key);
    if (flattenValue !== undefined || _value !== undefined) {
      aliasValue = _value ?? flattenValue;
      break;
    }
  }
  return aliasValue;
};
