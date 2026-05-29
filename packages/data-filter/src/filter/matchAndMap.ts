import * as _ from 'lodash';
import { matchQuery } from './matchQuery';
import { FilterMatchQuery } from '../types';
import { aliasData } from '../alias/aliasData';

type AnyObjectData = { [key: string]: any };

export function matchAndMap<T>(
  filterData: any[],
  filterMetadatas: FilterMappingMetadata[],
  exData: AnyObjectData = {},
  dataKey = 'data',
): T[] {
  if (filterMetadatas.length == 0) {
    return filterData as T[];
  }
  const matchUserOrderItemMap = filterMetadatas.reduce((pre, cur) => {
    const { filter, mappings } = cur;
    for (const item of filterData) {
      const _item = _.cloneDeep(item);
      const data: AnyObjectData = {
        ...exData,
        [dataKey]: item,
      };
      const convertFilter = aliasData<FilterMatchQuery>(
        _.cloneDeep(filter),
        data,
      );
      const convertMapping = aliasData<MappingValue[]>(
        _.cloneDeep(mappings ?? []),
        data,
      );
      if (matchQuery(data, convertFilter)) {
        const matchData = genItemMappingData(dataKey, data, convertMapping);
        pre.set(_item, matchData as T);
      }
    }
    return pre;
  }, new Map<number, T>());

  return Array.from(matchUserOrderItemMap.values());
}

type MappingDataValue = string | number | MappingObject[];

function genItemMappingData(
  dataKey: string,
  data: AnyObjectData,
  mappings: MappingValue[],
): AnyObjectData {
  const runMapping = {
    values: (
      _dataKey: string,
      _key: string,
      _data: AnyObjectData,
      _value: MappingDataValue,
    ) => genMappingDataByValue(_dataKey, _key, _data, _value),
    value: (
      _dataKey: string,
      _key: string,
      _data: AnyObjectData,
      _value: MappingDataValue,
    ) => genMappingDataByValue(_dataKey, _key, _data, _value),
  };
  for (const mapping of mappings) {
    const { type, key, value } = mapping;
    runMapping[type](dataKey, key, data, value);
  }
  return _.get(data, dataKey);
}

function genMappingDataByValue(
  dataKey: string,
  key: string,
  data: AnyObjectData,
  value: string | number | MappingObject[],
): void {
  data[dataKey][key] = value;
}

export type FilterMappingMetadata = {
  filter: FilterMatchQuery;
  mappings?: MappingValue[];
};

export type MappingType = 'value';
export type MappingObject = {
  mappingKey?: string;
  value?: string | number;
};

export type MappingValue = {
  key: string;
  type: MappingType;
  value: string | number | MappingObject[];
};
