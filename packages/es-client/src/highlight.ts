import type { EsHit } from './types';

export interface HighlightOptions {
  fields: string[];
  preTags?: string[];
  postTags?: string[];
  numberOfFragments?: number;
}

export function buildHighlight(opts: HighlightOptions): {
  highlight: Record<string, unknown>;
} {
  const fragments = opts.numberOfFragments ?? 0;
  const fields: Record<string, { number_of_fragments: number }> = {};
  for (const f of opts.fields) {
    fields[f] = { number_of_fragments: fragments };
  }
  return {
    highlight: {
      pre_tags: opts.preTags ?? ['<em>'],
      post_tags: opts.postTags ?? ['</em>'],
      fields,
    },
  };
}

export function parseHighlight<T = unknown>(
  hit: EsHit<T>,
): Record<string, string[]> {
  return hit.highlight ?? {};
}
