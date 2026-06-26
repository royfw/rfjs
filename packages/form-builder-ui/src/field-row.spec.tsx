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

describe('FieldRow', () => {
  it('edits the label', () => {
    const { onUpdate } = renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    fireEvent.change(screen.getByDisplayValue('Name'), { target: { value: 'Full name' } });
    expect(onUpdate).toHaveBeenCalledWith({ label: 'Full name' });
  });

  it('toggles required', () => {
    const { onUpdate } = renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith({ required: true });
  });

  it('removes the field', () => {
    const { onRemove } = renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    fireEvent.click(screen.getByRole('button', { name: /remove|delete/i }));
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
