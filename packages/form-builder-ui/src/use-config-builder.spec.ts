import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigBuilder } from './use-config-builder';
import type { FormConfig, FieldConfig, FormSection } from '@rfjs/form-builder';
import { normalizeToSections } from '@rfjs/form-builder';

const f = (key: string): FieldConfig => ({ key, label: key, component: 'Input', dataType: 'string' });
const initial: FormConfig = { version: 1, fields: [f('a'), f('b')] };

describe('useConfigBuilder — v1 back-compat ops', () => {
  it('adds, updates, removes and moves fields, and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useConfigBuilder(initial, onChange));

    act(() => result.current.add(f('c')));
    expect((result.current.config.fields ?? []).map((x) => x.key)).toEqual(['a', 'b', 'c']);

    act(() => result.current.update('b', { label: 'Bee' }));
    expect(result.current.config.fields![1]!.label).toBe('Bee');

    act(() => result.current.move(0, 2));
    expect((result.current.config.fields ?? []).map((x) => x.key)).toEqual(['b', 'c', 'a']);

    act(() => result.current.remove('c'));
    expect((result.current.config.fields ?? []).map((x) => x.key)).toEqual(['b', 'a']);

    act(() => result.current.setColumns(2));
    expect(result.current.config.columns).toBe(2);

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(result.current.config);
  });

  it('applies back-to-back ops against the latest config (no stale closure)', () => {
    const { result } = renderHook(() => useConfigBuilder({ version: 1, fields: [] }));
    act(() => {
      result.current.add(f('a'));
      result.current.add(f('b'));
    });
    expect((result.current.config.fields ?? []).map((x) => x.key)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// V2 tree-op wrappers
// ---------------------------------------------------------------------------

/** Build a v2 sections config for testing */
function sectionsConfig(): FormConfig {
  return {
    version: 2,
    sections: [
      {
        id: 's1',
        rows: [
          { id: 'r1', items: [{ id: 'item_a', kind: 'divider' as const }] },
          { id: 'r2', items: [{ id: 'item_b', kind: 'divider' as const }, { id: 'item_c', kind: 'divider' as const }] },
        ],
      },
    ],
  };
}

function getAllItemIds(config: FormConfig): string[] {
  return normalizeToSections(config).flatMap((s) => s.rows).flatMap((r) => r.items).map((i) => i.id);
}

function getSection(config: FormConfig, sectionId: string): FormSection | undefined {
  return normalizeToSections(config).find((s) => s.id === sectionId);
}

describe('useConfigBuilder — addItem', () => {
  it('adds an item to the specified section+row', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.addItem('s1', 'r1', { id: 'item_new', kind: 'divider' }));
    const ids = getAllItemIds(result.current.config);
    expect(ids).toContain('item_new');
  });
});

describe('useConfigBuilder — removeItem', () => {
  it('removes an item by id', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.removeItem('item_a'));
    const ids = getAllItemIds(result.current.config);
    expect(ids).not.toContain('item_a');
  });
});

describe('useConfigBuilder — updateItem', () => {
  it('patches an item by id', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.updateItem('item_b', { kind: 'spacer' } as never));
    const s1 = getSection(result.current.config, 's1')!;
    const item = s1.rows.flatMap((r) => r.items).find((i) => i.id === 'item_b');
    expect(item?.kind).toBe('spacer');
  });
});

describe('useConfigBuilder — moveItemWithinRow', () => {
  it('reorders items within a row', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.moveItemWithinRow('r2', 0, 1));
    const s1 = getSection(result.current.config, 's1')!;
    const r2 = s1.rows.find((r) => r.id === 'r2')!;
    expect(r2.items.map((i) => i.id)).toEqual(['item_c', 'item_b']);
  });
});

describe('useConfigBuilder — moveItemToRow', () => {
  it('moves an item to a different row', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.moveItemToRow('item_a', 'r2'));
    const s1 = getSection(result.current.config, 's1')!;
    const r2 = s1.rows.find((r) => r.id === 'r2')!;
    expect(r2.items.map((i) => i.id)).toContain('item_a');
    // r1 should be gone (was empty)
    const r1 = s1.rows.find((r) => r.id === 'r1');
    expect(r1).toBeUndefined();
  });
});

describe('useConfigBuilder — splitToNewRow', () => {
  it('splits an item into a new row at the given index', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.splitToNewRow('item_b', 's1', 0));
    const s1 = getSection(result.current.config, 's1')!;
    // item_b should be in a new row at index 0
    expect(s1.rows[0]!.items[0]!.id).toBe('item_b');
  });
});

describe('useConfigBuilder — addSection', () => {
  it('adds a new section', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    const beforeCount = normalizeToSections(result.current.config).length;
    act(() => result.current.addSection());
    const afterCount = normalizeToSections(result.current.config).length;
    expect(afterCount).toBe(beforeCount + 1);
  });
});

describe('useConfigBuilder — setSectionColumns', () => {
  it('sets columns on the given section', () => {
    const { result } = renderHook(() => useConfigBuilder(sectionsConfig()));
    act(() => result.current.setSectionColumns('s1', 2));
    const s1 = getSection(result.current.config, 's1')!;
    expect(s1.columns).toBe(2);
  });
});
