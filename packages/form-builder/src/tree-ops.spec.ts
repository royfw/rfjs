import { describe, it, expect } from 'vitest';
import {
  makeItem,
  addItem,
  removeItem,
  updateItem,
  moveItemWithinRow,
  moveItemToRow,
  splitToNewRow,
  addRow,
  addSection,
  setSectionColumns,
} from './tree-ops';

// Base config with one section, one row, two field items
const base = () =>
  ({
    version: 1,
    sections: [
      {
        id: 's1',
        rows: [
          {
            id: 'r1',
            items: [
              { id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' },
              { id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' },
            ],
          },
        ],
      },
    ],
  }) as any;

// --- makeItem ---

describe('makeItem', () => {
  it('makeItem(field) creates a field item with a unique id + key', () => {
    const a = makeItem('field');
    const b = makeItem('field');
    expect(a.kind).toBe('field');
    expect(a.id).not.toBe(b.id);
    // field items have key
    expect((a as any).key).toBeDefined();
    expect((a as any).key).not.toBe((b as any).key);
  });

  it('makeItem(field) has sensible defaults', () => {
    const item = makeItem('field') as any;
    expect(item.kind).toBe('field');
    expect(item.label).toBe('Field');
    expect(item.component).toBe('Input');
    expect(item.dataType).toBe('string');
  });

  it('makeItem(field) merges seed', () => {
    const item = makeItem('field', { label: 'Custom', dataType: 'numeric' }) as any;
    expect(item.label).toBe('Custom');
    expect(item.dataType).toBe('numeric');
    expect(item.component).toBe('Input'); // default preserved
  });

  it('makeItem(field) ignores caller-supplied id/kind — makeItem owns them', () => {
    const item = makeItem('field', { id: 'x', kind: 'divider', label: 'L' } as any) as any;
    expect(item.id).not.toBe('x'); // generated, not the override
    expect(item.kind).toBe('field'); // not overridden to 'divider'
    expect(item.label).toBe('L'); // other seed props still applied
  });

  it('makeItem(divider) has kind divider and no key', () => {
    const item = makeItem('divider');
    expect(item).toMatchObject({ kind: 'divider' });
    expect((item as any).key).toBeUndefined();
  });

  it('makeItem(content) has kind content', () => {
    const item = makeItem('content');
    expect(item).toMatchObject({ kind: 'content' });
  });

  it('makeItem(spacer) has kind spacer', () => {
    const item = makeItem('spacer');
    expect(item).toMatchObject({ kind: 'spacer' });
  });

  it('makeItem(ai-note) has kind ai-note', () => {
    const item = makeItem('ai-note');
    expect(item).toMatchObject({ kind: 'ai-note' });
  });

  it('makeItem(button) has kind button with a custom default action (not submit)', () => {
    const item = makeItem('button');
    expect(item).toMatchObject({ kind: 'button', label: 'Button', action: { type: 'custom', name: 'action-1' } });
  });

  it("makeItem('result') gives a json-mode result item", () => {
    const item = makeItem('result');
    expect(item).toMatchObject({ id: item.id, kind: 'result', mode: 'json' });
  });
});

// --- addItem ---

describe('addItem', () => {
  it('addItem appends to a row when no index given', () => {
    const c = addItem(base(), 's1', 'r1', makeItem('divider'));
    expect(c.sections![0].rows[0].items).toHaveLength(3);
    expect(c.sections![0].rows[0].items[2].kind).toBe('divider');
  });

  it('addItem inserts at given index', () => {
    const divider = makeItem('divider');
    const c = addItem(base(), 's1', 'r1', divider, 0);
    expect(c.sections![0].rows[0].items[0].id).toBe(divider.id);
    expect(c.sections![0].rows[0].items).toHaveLength(3);
  });

  it('addItem result has no fields property (sections-shaped)', () => {
    const c = addItem(base(), 's1', 'r1', makeItem('divider'));
    expect((c as any).fields).toBeUndefined();
  });
});

// --- removeItem ---

describe('removeItem', () => {
  it('removeItem drops the item but keeps the row if still non-empty', () => {
    const c = removeItem(base(), 'a');
    expect(c.sections![0].rows[0].items.map((i: any) => i.id)).toEqual(['b']);
  });

  it('removeItem removes an empty row after the last item is removed', () => {
    // Start with a config where r1 has only item 'a'
    const cfg = {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            { id: 'r1', items: [{ id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' }] },
            { id: 'r2', items: [{ id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
          ],
        },
      ],
    } as any;
    const c = removeItem(cfg, 'a');
    // r1 is now empty and should be removed
    expect(c.sections![0].rows).toHaveLength(1);
    expect(c.sections![0].rows[0].id).toBe('r2');
  });
});

// --- updateItem ---

describe('updateItem', () => {
  it('updateItem patches a field item', () => {
    const c = updateItem(base(), 'a', { label: 'Alpha' });
    const item = c.sections![0].rows[0].items[0] as any;
    expect(item.label).toBe('Alpha');
    expect(item.id).toBe('a');
  });

  it('updateItem does not mutate other items', () => {
    const c = updateItem(base(), 'a', { label: 'Alpha' });
    const itemB = c.sections![0].rows[0].items[1] as any;
    expect(itemB.label).toBe('B');
  });
});

// --- moveItemWithinRow ---

describe('moveItemWithinRow', () => {
  it('moveItemWithinRow reorders items in a row', () => {
    const c = moveItemWithinRow(base(), 'r1', 0, 1);
    expect(c.sections![0].rows[0].items.map((i: any) => i.id)).toEqual(['b', 'a']);
  });

  it('moveItemWithinRow is a no-op when from === to', () => {
    const c = moveItemWithinRow(base(), 'r1', 0, 0);
    expect(c.sections![0].rows[0].items.map((i: any) => i.id)).toEqual(['a', 'b']);
  });
});

// --- moveItemToRow ---

describe('moveItemToRow', () => {
  it('moveItemToRow moves item to target row', () => {
    const cfg = {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            { id: 'r1', items: [{ id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' }] },
            { id: 'r2', items: [{ id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
          ],
        },
      ],
    } as any;
    const c = moveItemToRow(cfg, 'a', 'r2');
    // r1 is now empty (dropped), r2 has both items
    expect(c.sections![0].rows).toHaveLength(1);
    expect(c.sections![0].rows[0].id).toBe('r2');
    expect(c.sections![0].rows[0].items.map((i: any) => i.id)).toEqual(['b', 'a']);
  });

  it('moveItemToRow inserts at specific index in target row', () => {
    const cfg = {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            { id: 'r1', items: [{ id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' }] },
            { id: 'r2', items: [{ id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
          ],
        },
      ],
    } as any;
    const c = moveItemToRow(cfg, 'a', 'r2', 0);
    expect(c.sections![0].rows[0].items.map((i: any) => i.id)).toEqual(['a', 'b']);
  });

  it('moveItemToRow drops empty source row', () => {
    const cfg = {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            { id: 'r1', items: [{ id: 'only', kind: 'divider' }] },
            { id: 'r2', items: [{ id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
          ],
        },
      ],
    } as any;
    const c = moveItemToRow(cfg, 'only', 'r2');
    expect(c.sections![0].rows).toHaveLength(1);
    expect(c.sections![0].rows[0].id).toBe('r2');
  });
});

// --- splitToNewRow ---

describe('splitToNewRow', () => {
  it('splitToNewRow moves an item into a new row at given index', () => {
    const c = splitToNewRow(base(), 'b', 's1', 1);
    expect(c.sections![0].rows.map((r: any) => r.items.map((i: any) => i.id))).toEqual([['a'], ['b']]);
  });

  it('splitToNewRow leaves source row intact (non-empty)', () => {
    const c = splitToNewRow(base(), 'b', 's1', 1);
    expect(c.sections![0].rows[0].items).toHaveLength(1);
  });

  it('splitToNewRow drops the source row when it had only that item', () => {
    // r1 holds the sole item 'only'; r2 is the keeper.
    const cfg = {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            { id: 'r1', items: [{ id: 'only', kind: 'divider' }] },
            { id: 'r2', items: [{ id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
          ],
        },
      ],
    } as any;
    // index 1 is computed AFTER the now-empty source row is dropped:
    // remaining rows = [r2], so insert the new row at index 1 → appended after r2.
    const c = splitToNewRow(cfg, 'only', 's1', 1);
    expect(c.sections![0].rows.map((r: any) => r.items.map((i: any) => i.id))).toEqual([['b'], ['only']]);
    // source row r1 is gone
    expect(c.sections![0].rows.find((r: any) => r.id === 'r1')).toBeUndefined();
  });
});

// --- addRow ---

describe('addRow', () => {
  it('addRow appends a new empty row to a section', () => {
    const c = addRow(base(), 's1');
    expect(c.sections![0].rows).toHaveLength(2);
    expect(c.sections![0].rows[1].items).toHaveLength(0);
  });

  it('addRow inserts at given index', () => {
    const c = addRow(base(), 's1', 0);
    expect(c.sections![0].rows).toHaveLength(2);
    expect(c.sections![0].rows[0].items).toHaveLength(0);
    expect(c.sections![0].rows[1].id).toBe('r1');
  });

  it('addRow returns a sections-shaped config', () => {
    const c = addRow(base(), 's1');
    expect((c as any).fields).toBeUndefined();
    expect(c.sections).toBeDefined();
  });
});

// --- addSection ---

describe('addSection', () => {
  it('addSection appends a new empty section', () => {
    const c = addSection(base());
    expect(c.sections).toHaveLength(2);
    expect(c.sections![1].rows).toHaveLength(0);
  });

  it('addSection inserts at given index', () => {
    const c = addSection(base(), 0);
    expect(c.sections).toHaveLength(2);
    expect(c.sections![0].rows).toHaveLength(0);
    expect(c.sections![1].id).toBe('s1');
  });

  it('normalizes a v1 config before operating', () => {
    const v1 = {
      version: 1,
      fields: [{ key: 'x', label: 'X', component: 'Input', dataType: 'string' }],
    } as any;
    const c = addSection(v1);
    expect(c.sections).toHaveLength(2); // implicit section + new one
    expect((c as any).fields).toBeUndefined(); // result is sections-shaped
  });
});

// --- setSectionColumns ---

describe('setSectionColumns', () => {
  it('setSectionColumns sets columns on a section', () => {
    const c = setSectionColumns(base(), 's1', 2);
    expect(c.sections![0].columns).toBe(2);
  });

  it('setSectionColumns does not affect other sections', () => {
    const cfg = {
      version: 1,
      sections: [
        { id: 's1', rows: [] },
        { id: 's2', rows: [], columns: 1 as const },
      ],
    } as any;
    const c = setSectionColumns(cfg, 's1', 3);
    expect(c.sections![0].columns).toBe(3);
    expect(c.sections![1].columns).toBe(1);
  });

  it('setSectionColumns returns a sections-shaped config', () => {
    const c = setSectionColumns(base(), 's1', 2);
    expect((c as any).fields).toBeUndefined();
  });
});

// --- v1 normalization: every op normalizes a v1 config and returns a sections-shaped result ---

describe('v1 normalization (all ops)', () => {
  const v1 = () =>
    ({
      version: 1,
      fields: [{ key: 'x', label: 'X', component: 'Input', dataType: 'string' }],
    }) as any;

  // For a v1 config, normalizeToSections produces: section 'section-default',
  // one row 'row-x' containing item id 'x'. We use those ids in the ops below.
  const ops: Array<[string, (cfg: any) => any]> = [
    ['addItem', (cfg) => addItem(cfg, 'section-default', 'row-x', makeItem('divider'))],
    ['removeItem', (cfg) => removeItem(cfg, 'x')],
    ['updateItem', (cfg) => updateItem(cfg, 'x', { label: 'Y' })],
    ['moveItemWithinRow', (cfg) => moveItemWithinRow(cfg, 'row-x', 0, 0)],
    ['moveItemToRow', (cfg) => moveItemToRow(cfg, 'x', 'row-x')],
    ['splitToNewRow', (cfg) => splitToNewRow(cfg, 'x', 'section-default', 0)],
    ['addRow', (cfg) => addRow(cfg, 'section-default')],
    ['addSection', (cfg) => addSection(cfg)],
    ['setSectionColumns', (cfg) => setSectionColumns(cfg, 'section-default', 2)],
  ];

  for (const [name, run] of ops) {
    it(`${name} normalizes a v1 config → sections-shaped, fields undefined`, () => {
      const c = run(v1());
      expect(c.sections).not.toBeUndefined();
      expect((c as any).fields).toBeUndefined();
    });
  }
});
