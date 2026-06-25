import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigBuilder } from './use-config-builder';
import type { FormConfig, FieldConfig } from '@rfjs/form-builder';

const f = (key: string): FieldConfig => ({ key, label: key, component: 'Input', dataType: 'string' });
const initial: FormConfig = { version: 1, fields: [f('a'), f('b')] };

describe('useConfigBuilder', () => {
  it('adds, updates, removes and moves fields, and fires onChange', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useConfigBuilder(initial, onChange));

    act(() => result.current.add(f('c')));
    expect(result.current.config.fields.map((x) => x.key)).toEqual(['a', 'b', 'c']);

    act(() => result.current.update('b', { label: 'Bee' }));
    expect(result.current.config.fields[1]!.label).toBe('Bee');

    act(() => result.current.move(0, 2));
    expect(result.current.config.fields.map((x) => x.key)).toEqual(['b', 'c', 'a']);

    act(() => result.current.remove('c'));
    expect(result.current.config.fields.map((x) => x.key)).toEqual(['b', 'a']);

    act(() => result.current.setColumns(2));
    expect(result.current.config.columns).toBe(2);

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenLastCalledWith(result.current.config);
  });
});
