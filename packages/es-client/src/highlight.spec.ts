import { describe, it, expect } from 'vitest';
import { buildHighlight, parseHighlight } from './highlight';
import type { EsHit } from './types';

describe('highlight', () => {
  it('buildHighlight with defaults', () => {
    expect(buildHighlight({ fields: ['title', 'body'] })).toEqual({
      highlight: {
        pre_tags: ['<em>'],
        post_tags: ['</em>'],
        fields: { title: { number_of_fragments: 0 }, body: { number_of_fragments: 0 } },
      },
    });
  });

  it('buildHighlight with custom tags and fragments', () => {
    expect(buildHighlight({ fields: ['t'], preTags: ['<c>'], postTags: ['</c>'], numberOfFragments: 3 })).toEqual({
      highlight: {
        pre_tags: ['<c>'],
        post_tags: ['</c>'],
        fields: { t: { number_of_fragments: 3 } },
      },
    });
  });

  it('parseHighlight returns the highlight map or empty', () => {
    const hit = { _index: 'i', _id: '1', _score: 1, _source: {}, highlight: { body: ['a <em>b</em>'] } } as EsHit;
    expect(parseHighlight(hit)).toEqual({ body: ['a <em>b</em>'] });
    expect(parseHighlight({ _index: 'i', _id: '1', _score: 1, _source: {} } as EsHit)).toEqual({});
  });
});
