import { genFilterQueryMetadata } from './genFilterQueryMetadata';
import { FilterQueryMetadata } from './type';
describe('genFilterQueryMetadata', () => {
  it('should work', () => {
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  it('genFilterQueryMetadata empty', () => {
    const filterQuery: FilterQueryMetadata = {
      logic: 'and',
      filters: [],
    };
    const query = genFilterQueryMetadata('properties', filterQuery);
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  it('genFilterQueryMetadata filter err operator', () => {
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
    const query = genFilterQueryMetadata(
      'properties',
      filterQuery as FilterQueryMetadata,
    );
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  // it('genFilterQueryMetadata filter err dataType', () => {
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
  //     const query = genFilterQueryMetadata('properties', filterQuery as FilterQueryMetadata);
  //     console.log(query);
  //     expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  // })

  it('genFilterQueryMetadata filter 1', () => {
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
    const query = genFilterQueryMetadata('properties', filterQuery);
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  it('genFilterQueryMetadata filter 1 string', () => {
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
    const query = genFilterQueryMetadata('properties', filterQuery);
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  it('genFilterQueryMetadata filter 2', () => {
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
    const query = genFilterQueryMetadata('properties', filterQuery);
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  it('genFilterQueryMetadata filter 0, FilterQueryMetadata 2', () => {
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
    const query = genFilterQueryMetadata('properties', filterQuery);
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });

  it('genFilterQueryMetadata filter 1, FilterQueryMetadata 2', () => {
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
    const query = genFilterQueryMetadata('properties', filterQuery);
    console.log(query);
    expect('genFilterQueryMetadata').toEqual('genFilterQueryMetadata');
  });
});
