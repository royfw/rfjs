import _ from 'lodash';
import { matchQuery } from './matchQuery';
import { FilterMatchQuery } from '../types';
import { aliasData } from '../alias/aliasData';
import { isExpression } from '@rfjs/data-expr';

type AnyObjectData = { [key: string]: any };

export function matchAndMap<T>(
  filterData: AnyObjectData[],
  filterMetadatas: FilterMappingMetadata[],
  exData: AnyObjectData = {},
  dataKey = 'data',
): T[] {
  if (filterMetadatas.length === 0) {
    return filterData as T[];
  }
  for (const metadata of filterMetadatas) {
    const hasExprMapping = (metadata.mappings ?? []).some(
      (mapping) => typeof mapping.value === 'string' && isExpression(mapping.value),
    );
    if (hasExprMapping) {
      throw new Error(
        `[data-filter] '=' expression mapping values require the async api — use matchAndMapAsync`,
      );
    }
  }
  // Keyed by the ORIGINAL source row so a row matched by several metadata is
  // emitted once (last matching metadata's mapping wins). `aliasData` clones
  // the filter/mappings internally, so we pass them as-is (no extra clone), and
  // matching is read-only, so we only deep-clone the row once it matches.
  const matched = new Map<AnyObjectData, T>();
  for (const { filter, mappings } of filterMetadatas) {
    for (const item of filterData) {
      const source: AnyObjectData = { ...exData, [dataKey]: item };
      const convertFilter = aliasData<FilterMatchQuery>(filter, source);
      if (!matchQuery(source, convertFilter)) continue;

      const clonedItem = _.cloneDeep(item);
      const mapped: AnyObjectData = { ...exData, [dataKey]: clonedItem };
      const convertMapping = aliasData<MappingValue[]>(mappings ?? [], mapped);
      const matchData = genItemMappingData(dataKey, mapped, convertMapping);
      matched.set(item, matchData as T);
    }
  }
  return Array.from(matched.values());
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
