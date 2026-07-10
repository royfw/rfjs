import type { BuiltRequest, PageState, RequestMeta } from './types';

export function buildRequestParams(request: RequestMeta, state: PageState, filter?: unknown): BuiltRequest {
  const params: Record<string, string> = {};
  const { pagination } = request;

  switch (pagination.strategy) {
    case 'offset':
      params[pagination.limitParam] = String(state.pageSize);
      params[pagination.offsetParam] = String(state.offset ?? 0);
      break;
    case 'page':
      params[pagination.pageParam] = String(state.page ?? pagination.firstPage ?? 1);
      params[pagination.pageSizeParam] = String(state.pageSize);
      break;
    case 'cursor':
      params[pagination.limitParam] = String(state.pageSize);
      if (state.cursor !== undefined) {
        params[pagination.cursorParam] = state.cursor;
      }
      break;
  }

  if (request.sort && state.sort) {
    const { key, direction } = state.sort;
    const sort = request.sort;
    if (sort.style === 'single') {
      params[sort.param] = sort.encoding === 'colon' ? `${key}:${direction}` : `${direction === 'desc' ? '-' : ''}${key}`;
    } else {
      params[sort.fieldParam] = key;
      params[sort.dirParam] = direction;
    }
  }

  const built: BuiltRequest = { endpoint: request.endpoint, method: request.method ?? 'GET', params };
  if (request.filter && filter !== undefined) built.filter = filter;
  return built;
}
