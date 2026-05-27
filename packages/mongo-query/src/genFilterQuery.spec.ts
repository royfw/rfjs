import { describe, it, expect } from 'vitest';
import { type MgoFilterMetadata, genFilterQuery } from './genFilterQuery';
import { EqQuery, GTQuery, LogicalQuery } from './query';

describe('Test Mongo genFilterQuery', () => {
  it('should return a LogicalQuery object', () => {
    const filterQuery: MgoFilterMetadata = {
      logic: 'and',
      filters: [
        {
          field: 'name',
          condition: 'eq',
          dataType: 'string',
          value: 'test'
        }
      ]
    };
    const root = new LogicalQuery();
    const eqName = new EqQuery('name', 'test');
    root.$and = [eqName];
    const result = genFilterQuery(filterQuery);
    console.info('result: ', JSON.stringify(result))
    expect(result).toBeInstanceOf(LogicalQuery);
    expect(result).toEqual(root);
  });
  it('should return a LogicalQuery object with nested query', () => {
    const filterQuery: MgoFilterMetadata = {
      logic: 'and',
      filters: [
        {
          field: 'name',
          condition: 'eq',
          dataType: 'string',
          value: 'test'
        },
        {
          logic: 'or',
          filters: [
            {
              field: 'age',
              condition: 'gt',
              dataType: 'number',
              value: 18
            },
            {
              field: 'address',
              condition: 'eq',
              dataType: 'string',
              value: null
            }
          ]
        }
      ]
    };
    const root = new LogicalQuery();
    const eqName = new EqQuery('name', 'test');
    const orLogic = new LogicalQuery();
    const orGtAge = new GTQuery('age', 18);
    const orEqAddress = new EqQuery('address', null);
    orLogic.$or = [orGtAge, orEqAddress];
    root.$and = [eqName, orLogic];
    const result = genFilterQuery(filterQuery);
    console.info('result: ', JSON.stringify(result))
    expect(result).toBeInstanceOf(LogicalQuery);
    expect(result).toEqual(root);
  });
});
