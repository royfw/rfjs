import { describe, expect, it } from 'vitest';
import { buildRequestParams } from './request';
import type { RequestMeta } from './types';

describe('buildRequestParams', () => {
  it('builds offset-strategy params', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
    };
    const built = buildRequestParams(request, { pageSize: 10, offset: 20 });
    expect(built.params).toEqual({ limit: '10', offset: '20' });
  });

  it('builds page-strategy params, defaulting to firstPage (default 1) only when state.page is absent', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'page', pageParam: 'page', pageSizeParam: 'size' },
    };
    // state.page is the API-native page number and is passed through as-is.
    const built = buildRequestParams(request, { pageSize: 10, page: 3 });
    expect(built.params).toEqual({ page: '3', size: '10' });
  });

  it('defaults page to pagination.firstPage when state.page is undefined', () => {
    const requestFirstPage0: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'page', pageParam: 'page', pageSizeParam: 'size', firstPage: 0 },
    };
    expect(buildRequestParams(requestFirstPage0, { pageSize: 10 }).params).toEqual({ page: '0', size: '10' });

    const requestNoFirstPage: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'page', pageParam: 'page', pageSizeParam: 'size' },
    };
    expect(buildRequestParams(requestNoFirstPage, { pageSize: 10 }).params).toEqual({ page: '1', size: '10' });
  });

  it('builds cursor-strategy params, omitting the cursor param when state.cursor is undefined', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'cursor', cursorParam: 'cursor', limitParam: 'limit' },
    };
    expect(buildRequestParams(request, { pageSize: 10 }).params).toEqual({ limit: '10' });
    expect(buildRequestParams(request, { pageSize: 10, cursor: 'abc' }).params).toEqual({ limit: '10', cursor: 'abc' });
  });

  it('encodes single-style colon sort', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
      sort: { style: 'single', param: 'sort', encoding: 'colon' },
    };
    const built = buildRequestParams(request, { pageSize: 10, offset: 0, sort: { key: 'name', direction: 'asc' } });
    expect(built.params.sort).toBe('name:asc');
  });

  it('encodes single-style signed sort (desc gets a leading -, asc has no prefix)', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
      sort: { style: 'single', param: 'sort', encoding: 'signed' },
    };
    const desc = buildRequestParams(request, { pageSize: 10, offset: 0, sort: { key: 'name', direction: 'desc' } });
    expect(desc.params.sort).toBe('-name');
    const asc = buildRequestParams(request, { pageSize: 10, offset: 0, sort: { key: 'name', direction: 'asc' } });
    expect(asc.params.sort).toBe('name');
  });

  it('encodes split-style sort into two params', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
      sort: { style: 'split', fieldParam: 'sortBy', dirParam: 'order' },
    };
    const built = buildRequestParams(request, { pageSize: 10, offset: 0, sort: { key: 'name', direction: 'asc' } });
    expect(built.params).toEqual({ limit: '10', offset: '0', sortBy: 'name', order: 'asc' });
  });

  it('omits sort params entirely when state.sort is absent', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
      sort: { style: 'split', fieldParam: 'sortBy', dirParam: 'order' },
    };
    const built = buildRequestParams(request, { pageSize: 10, offset: 0 });
    expect(built.params).toEqual({ limit: '10', offset: '0' });
  });

  it('defaults method to GET and passes endpoint through; explicit method is respected', () => {
    const request: RequestMeta = {
      endpoint: '/api/items',
      pagination: { strategy: 'offset', limitParam: 'limit', offsetParam: 'offset' },
    };
    const built = buildRequestParams(request, { pageSize: 10, offset: 0 });
    expect(built.endpoint).toBe('/api/items');
    expect(built.method).toBe('GET');

    const postRequest: RequestMeta = { ...request, method: 'POST' };
    expect(buildRequestParams(postRequest, { pageSize: 10, offset: 0 }).method).toBe('POST');
  });
});
