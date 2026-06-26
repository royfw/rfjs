import { normalizeToSections, collectFieldItems, isFieldItem } from './normalize';

const v1 = { version: 1, fields: [
  { key: 'name', label: 'Name', component: 'Input', dataType: 'string' },
  { key: 'age', label: 'Age', component: 'Input', dataType: 'numeric' },
], columns: 2 };

it('normalizes v1 fields[] to one section, one row per field, kind=field', () => {
  const secs = normalizeToSections(v1 as any);
  expect(secs).toHaveLength(1);
  expect(secs[0].columns).toBe(2);
  expect(secs[0].rows.map(r => r.items.map(i => (i as any).key))).toEqual([['name'], ['age']]);
  expect(secs[0].rows[0].items[0]).toMatchObject({ kind: 'field', id: 'name', key: 'name' });
});

it('returns sections as-is for a v2 config', () => {
  const v2 = { version: 1, sections: [{ id: 's1', rows: [] }] };
  expect(normalizeToSections(v2 as any)).toBe(v2.sections);
});

it('collectFieldItems returns only field items, in order', () => {
  const v2 = { version: 1, sections: [{ id: 's1', rows: [
    { id: 'r1', items: [{ id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' }, { id: 'd', kind: 'divider' }] },
    { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'hi' }, { id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' }] },
  ] }] };
  expect(collectFieldItems(v2 as any).map(f => f.key)).toEqual(['a', 'b']);
});

it('isFieldItem narrows by kind', () => {
  expect(isFieldItem({ id: 'x', kind: 'field', key: 'x', label: '', component: 'Input', dataType: 'string' } as any)).toBe(true);
  expect(isFieldItem({ id: 'x', kind: 'divider' } as any)).toBe(false);
});
