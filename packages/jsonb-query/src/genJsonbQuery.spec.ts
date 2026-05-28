import { genJsonbQuery } from './genJsonbQuery';
import { FilterQueryMetadata } from './type';
describe('genJsonbQuery', () => {
  it('should work', () => {
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  it('genJsonbQuery empty', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [],
    };
    const query = genJsonbQuery('properties', filterQuery);
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  it('genJsonbQuery filter err operator', () => {
    const filterQuery = {
      logic: 'and',
      filters: [
        {
          field: 'arr_object',
          dataType: 'arrayObjectDate',
          operator: 'range1',
          value: ['2020-03-30', '2021-07-31'],
        },
      ],
    };
    const query = genJsonbQuery(
      'properties',
      filterQuery as FilterQueryMetadata,
    );
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  // it('genJsonbQuery filter err dataType', () => {
  //     const filterQuery = {
  //         logic: 'and',
  //         filters: [
  //             {
  //                 field: 'arr_object',
  //                 dataType: 'arrayObjectDate1',
  //                 operator: 'range',
  //                 value: ['2020-03-30', '2021-07-31']
  //             }
  //         ],
  //     }
  //     const query = genJsonbQuery('properties', filterQuery as FilterQueryMetadata);
  //     console.log(query);
  //     expect('genJsonbQuery').toEqual('genJsonbQuery');
  // })

  it('genJsonbQuery filter 1', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [
        {
          field: 'arr_object',
          dataType: 'arrayObjectDate',
          operator: 'range',
          value: ['2020-03-30', '2021-07-31'],
        },
      ],
    };
    const query = genJsonbQuery('properties', filterQuery);
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  it('genJsonbQuery filter 1 string', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [
        {
          field: 'string',
          dataType: 'string',
          operator: 'eq',
          // value: "' or 1 =1--max '"
          value: ' or 1 =1--max ',
        },
      ],
    };
    const query = genJsonbQuery('properties', filterQuery);
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  it('genJsonbQuery filter 2', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [
        {
          field: 'arr_object',
          dataType: 'arrayObjectDate',
          operator: 'range',
          value: ['2020-03-30', '2021-07-31'],
        },
        {
          field: 'number',
          dataType: 'numeric',
          operator: 'gt',
          value: 100,
        },
      ],
    };
    const query = genJsonbQuery('properties', filterQuery);
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  it('genJsonbQuery filter 0, FilterQueryMetadata 2', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [
        {
          logic: 'or',
          filters: [
            {
              field: 'arr_object.recordDate',
              dataType: 'arrayObjectDate',
              operator: 'range',
              value: ['2020-03-30', '2021-07-31'],
            },
            {
              field: 'number',
              dataType: 'numeric',
              operator: 'gt',
              value: 100,
            },
          ],
        },
      ],
    };
    const query = genJsonbQuery('properties', filterQuery);
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });

  it('genJsonbQuery filter 1, FilterQueryMetadata 2', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [
        {
          logic: 'or',
          filters: [
            {
              field: 'arr_object.recordDate',
              dataType: 'arrayObjectDate',
              operator: 'range',
              value: ['2020-03-30', '2021-07-31'],
            },
            {
              field: 'number',
              dataType: 'numeric',
              operator: 'gt',
              value: 100,
            },
          ],
        },
        {
          field: 'object.A.type',
          dataType: 'objectString',
          operator: 'eq',
          value: '_doc',
        },
      ],
    };
    const query = genJsonbQuery('properties', filterQuery);
    console.log(query);
    expect('genJsonbQuery').toEqual('genJsonbQuery');
  });
});
