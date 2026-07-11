import type { BuiltRequest, RequestMeta } from '@rfjs/data-schema';

/**
 * RequestMeta-driven HTTP transport for a remote `TableSource.fetch`. Serializes the tool's
 * `BuiltRequest` into a real-shaped request: GET puts params + filter (JSON) on the querystring,
 * POST puts them in the JSON body; the filter rides under `request.filter.param`. Non-2xx throws.
 */
export function makeHttpFetcher(request: RequestMeta): (built: BuiltRequest) => Promise<unknown> {
  const filterParam = request.filter?.param;
  return async (built: BuiltRequest): Promise<unknown> => {
    const method = built.method ?? 'GET';
    let res: Response;
    if (method === 'GET') {
      const qs = new URLSearchParams(built.params);
      if (built.filter !== undefined && filterParam) qs.set(filterParam, JSON.stringify(built.filter));
      res = await fetch(`${built.endpoint}?${qs.toString()}`, { method: 'GET' });
    } else {
      const body: Record<string, unknown> = { ...built.params };
      if (built.filter !== undefined && filterParam) body[filterParam] = built.filter;
      res = await fetch(built.endpoint, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    if (!res.ok) throw new Error(`query failed: ${res.status}`);
    return res.json();
  };
}
