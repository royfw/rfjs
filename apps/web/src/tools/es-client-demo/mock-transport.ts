import type {
  EsHit,
  EsSearchRequest,
  EsSearchResponse,
  SearchTransport,
} from "@rfjs/es-client";
import type { BuilderGroup, BuilderItem } from "@rfjs/filter-builder";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Unique string literals used in the tree's conditions — for demo highlight marking. */
export function extractTerms(tree: BuilderGroup): string[] {
  const out = new Set<string>();
  const walk = (items: BuilderItem[]): void => {
    for (const item of items) {
      if (item.kind === "group") {
        walk(item.children);
        continue;
      }
      const v = item.value;
      if (typeof v === "string" && v) out.add(v);
      else if (Array.isArray(v)) {
        for (const e of v) if (typeof e === "string" && e) out.add(e);
      }
    }
  };
  walk(tree.children);
  return [...out];
}

function mark(text: string, terms: string[]): string {
  let out = text;
  for (const t of terms) {
    if (!t) continue;
    out = out.replace(new RegExp(escapeRegex(t), "gi"), (m) => `<em>${m}</em>`);
  }
  return out;
}

export interface MockTransportOptions {
  terms?: string[];
  index?: string;
}

/**
 * A demo-only `SearchTransport` over an already-matched row set. The real query
 * predicate is applied upstream (via `runLiveMatch`); this only honors
 * `size` / `from` / `search_after` paging and `highlight.fields` marking, so the
 * real `@rfjs/es-client` `search` / `paginateAll` / highlight code paths run
 * against it unchanged.
 */
export function makeMockTransport(
  matched: Record<string, unknown>[],
  opts: MockTransportOptions = {},
): SearchTransport {
  const terms = opts.terms ?? [];
  const index = opts.index ?? "demo";
  const ordered = matched.map((doc, i) => ({ doc, i }));

  const toHit = (
    entry: { doc: Record<string, unknown>; i: number },
    fields?: string[],
  ): EsHit => {
    const { doc, i } = entry;
    const hit: EsHit = {
      _index: index,
      _id: String(doc.id ?? i),
      _score: 1,
      _source: doc,
      sort: [i],
    };
    if (fields?.length && terms.length) {
      const hl: Record<string, string[]> = {};
      for (const f of fields) {
        const v = doc[f];
        if (typeof v === "string") {
          const marked = mark(v, terms);
          if (marked !== v) hl[f] = [marked];
        }
      }
      if (Object.keys(hl).length) hit.highlight = hl;
    }
    return hit;
  };

  const pageOf = (body: Record<string, unknown>) => {
    const size = typeof body.size === "number" ? body.size : 10;
    let start = 0;
    const sa = body.search_after as unknown[] | undefined;
    if (sa && typeof sa[0] === "number") start = (sa[0] as number) + 1;
    else if (typeof body.from === "number") start = body.from;
    return ordered.slice(start, start + size);
  };

  const fieldsOf = (body: Record<string, unknown>): string[] | undefined => {
    const h = body.highlight as { fields?: Record<string, unknown> } | undefined;
    return h?.fields ? Object.keys(h.fields) : undefined;
  };

  return {
    search<T = unknown>(req: EsSearchRequest): Promise<EsSearchResponse<T>> {
      const body = req.body as Record<string, unknown>;
      const hits = pageOf(body).map((e) => toHit(e, fieldsOf(body)));
      return Promise.resolve({
        took: 0,
        timed_out: false,
        hits: {
          total: { value: ordered.length, relation: "eq" },
          max_score: ordered.length ? 1 : null,
          hits: hits as EsHit<T>[],
        },
      });
    },
    count(): Promise<number> {
      return Promise.resolve(ordered.length);
    },
    msearch<T = unknown>(): Promise<EsSearchResponse<T>[]> {
      return Promise.resolve([]);
    },
    openPit(): Promise<string> {
      return Promise.resolve("pit-mock");
    },
    closePit(): Promise<void> {
      return Promise.resolve();
    },
  };
}
