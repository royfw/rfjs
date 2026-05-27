import * as _ from 'lodash';
import { aliasRegex } from './aliasRegex';
import { flatten } from '@rfjs/object-utils';

export type ObjectData = { [key: string]: any };

export const aliasValue = (alias: string, data: ObjectData): any => {
  const matchAll = alias.matchAll(aliasRegex);
  const aliasData: ObjectData = {
    ...data,
    ...flatten(data),
  };
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
