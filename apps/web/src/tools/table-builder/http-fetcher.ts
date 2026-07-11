import type { BuiltRequest } from "@rfjs/data-schema";

/**
 * App-level minimal HTTP transport for a remote `TableSource.fetch`: POSTs the tool's
 * `BuiltRequest` to `endpoint` and returns the parsed JSON. Deliberately a thin, replaceable
 * adapter -- a package-level http-fetcher (#14) can supersede it; both share the same
 * `(built) => Promise<unknown>` signature and BuiltRequest/`{data}` contract.
 */
export function makeHttpFetcher(endpoint: string): (built: BuiltRequest) => Promise<unknown> {
  return async (built: BuiltRequest): Promise<unknown> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(built),
    });
    if (!res.ok) throw new Error(`query failed: ${res.status}`);
    return res.json();
  };
}
