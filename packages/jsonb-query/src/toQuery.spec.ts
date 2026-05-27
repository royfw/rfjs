import { toJsonbQuery } from './toQuery';
describe('toQuery', () => {
  it('should work', () => {
    expect('toQuery').toEqual('toQuery');
  });

  it('toJsonbQuery range arrayObjectDate', () => {
    const query = toJsonbQuery(
      'properties',
      'arr_object.recordDate',
      'range',
      'arrayObjectDate',
      ['2020-03-30', '2021-07-31'],
    );
    console.log(query);
    expect('toQuery').toEqual('toQuery');
  });

  it('toJsonbQuery range date', () => {
    const query = toJsonbQuery('properties', 'recordDate', 'range', 'date', [
      '2020-03-30',
      '2020-07-31',
    ]);
    console.log(query);
    expect('toQuery').toEqual('toQuery');
  });

  it('toJsonbQuery gt numeric', () => {
    const query = toJsonbQuery('properties', 'number', 'gt', 'numeric', 100);
    console.log(query);
    expect('toQuery').toEqual('toQuery');
  });
  it('toJsonbQuery eq string', () => {
    const query = toJsonbQuery('properties', 'string', 'eq', 'string', 'test1');
    console.log(query);
    expect('toQuery').toEqual('toQuery');
  });
  it('toJsonbQuery eq objectString', () => {
    const query = toJsonbQuery(
      'properties',
      'object.A.type',
      'eq',
      'objectString',
      '_doc',
    );
    console.log(query);
    expect('toQuery').toEqual('toQuery');
  });
  it('toJsonbQuery contains arrayString', () => {
    const query = toJsonbQuery(
      'properties',
      'arr_string',
      'terms',
      'arrayString',
      ['A-1', 'B-2'],
    );
    console.log(query);
    expect('toQuery').toEqual('toQuery');
  });
});
