import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { FieldRow, makeField } from './field-row';
import type { FieldConfig } from '@rfjs/form-builder';

function renderRow(field: FieldConfig, onUpdate = vi.fn(), onRemove = vi.fn()) {
  render(
    <DndContext>
      <SortableContext items={[field.key]}>
        <FieldRow field={field} onUpdate={onUpdate} onRemove={onRemove} />
      </SortableContext>
    </DndContext>,
  );
  return { onUpdate, onRemove };
}
const base: FieldConfig = { key: 'name', label: 'Name', component: 'Input', dataType: 'string' };

describe('FieldRow', () => {
  it('shows the property editor by default and collapses on toggle', () => {
    renderRow(base);
    expect(screen.getByLabelText('label for name')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /collapse field/i }));
    expect(screen.queryByLabelText('label for name')).toBeNull();
  });
  it('edits the label', () => {
    const { onUpdate } = renderRow(base);
    fireEvent.change(screen.getByLabelText('label for name'), { target: { value: 'Full name' } });
    expect(onUpdate).toHaveBeenCalledWith({ label: 'Full name' });
  });
  it('changes width', () => {
    const { onUpdate } = renderRow(base);
    fireEvent.change(screen.getByLabelText('width for name'), { target: { value: 'half' } });
    expect(onUpdate).toHaveBeenCalledWith({ width: 'half' });
  });
  it('changes type and remaps dataType/options', () => {
    const { onUpdate } = renderRow(base);
    fireEvent.change(screen.getByLabelText('type for name'), { target: { value: 'Select' } });
    expect(onUpdate).toHaveBeenCalledWith({ component: 'Select', dataType: 'string', options: [] });
  });
  it('toggles required', () => {
    const { onUpdate } = renderRow(base);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith({ required: true });
  });
  it('removes the field', () => {
    const { onRemove } = renderRow(base);
    fireEvent.click(screen.getByRole('button', { name: /remove field/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('makeField', () => {
  it('creates a defaulted field for a component with a unique-ish key', () => {
    const f = makeField('Select');
    expect(f.component).toBe('Select');
    expect(typeof f.key).toBe('string');
    expect(f.key.length).toBeGreaterThan(0);
    expect(typeof f.label).toBe('string');
  });
});
