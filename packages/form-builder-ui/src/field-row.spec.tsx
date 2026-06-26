// jsdom shim: radix-ui Select uses pointer capture and scrollIntoView APIs not available in jsdom
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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
  it('type trigger renders the current component value', () => {
    // Radix Select cannot be driven by fireEvent.change; assert the trigger shows current value
    renderRow(base);
    const trigger = screen.getByLabelText('type for name');
    expect(trigger.textContent).toContain('Input');
  });
  it('width trigger renders the current width value', () => {
    // Radix Select cannot be driven by fireEvent.change; assert the trigger shows current value
    renderRow(base);
    const trigger = screen.getByLabelText('width for name');
    expect(trigger.textContent).toContain('Full');
  });
  it('width trigger shows Half when field.width is half', () => {
    renderRow({ ...base, width: 'half' });
    const trigger = screen.getByLabelText('width for name');
    expect(trigger.textContent).toContain('Half');
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
  it('commits a key change on blur', () => {
    const { onUpdate } = renderRow(base);
    const keyInput = screen.getByLabelText('key for name');
    fireEvent.change(keyInput, { target: { value: 'full_name' } });
    expect(onUpdate).not.toHaveBeenCalled(); // not on each keystroke
    fireEvent.blur(keyInput);
    expect(onUpdate).toHaveBeenCalledWith({ key: 'full_name' });
  });
});

const selectField: FieldConfig = { key: 'role', label: 'Role', component: 'Select', dataType: 'string', options: [{ label: 'Admin', value: 'admin' }] };

describe('OptionsEditor', () => {
  it('adds an option to a Select field', () => {
    const { onUpdate } = renderRow(selectField);
    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    expect(onUpdate).toHaveBeenCalledWith({ options: [{ label: 'Admin', value: 'admin' }, { label: '', value: '' }] });
  });
  it('edits an option label', () => {
    const { onUpdate } = renderRow(selectField);
    fireEvent.change(screen.getByLabelText('option 0 label'), { target: { value: 'Administrator' } });
    expect(onUpdate).toHaveBeenCalledWith({ options: [{ label: 'Administrator', value: 'admin' }] });
  });
  it('removes an option', () => {
    const { onUpdate } = renderRow(selectField);
    fireEvent.click(screen.getByRole('button', { name: /remove option 0/i }));
    expect(onUpdate).toHaveBeenCalledWith({ options: [] });
  });
  it('shows no options editor for a non-Select field', () => {
    renderRow({ key: 'name', label: 'Name', component: 'Input', dataType: 'string' });
    expect(screen.queryByRole('button', { name: /add option/i })).toBeNull();
  });
});

describe('multi-locale label editing', () => {
  it('edits a per-locale label when multiple locales', () => {
    const onUpdate = vi.fn();
    render(
      <DndContext>
        <SortableContext items={['name']}>
          <FieldRow
            field={{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }}
            locales={['en', 'zh-TW']}
            onUpdate={onUpdate}
            onRemove={() => {}}
          />
        </SortableContext>
      </DndContext>,
    );
    fireEvent.change(screen.getByLabelText('label (zh-TW) for name'), { target: { value: '姓名' } });
    expect(onUpdate).toHaveBeenCalledWith({ label: { en: 'Name', 'zh-TW': '姓名' } });
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

const numericField: FieldConfig = { key: 'age', label: 'Age', component: 'Input', dataType: 'numeric' };
const stringField: FieldConfig = { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string' };

describe('ValidationEditor', () => {
  it('shows min and max inputs for a numeric field', () => {
    renderRow(numericField);
    expect(screen.getByLabelText('validation min')).toBeTruthy();
    expect(screen.getByLabelText('validation max')).toBeTruthy();
    expect(screen.queryByLabelText('validation minLength')).toBeNull();
    expect(screen.queryByLabelText('validation pattern')).toBeNull();
  });

  it('shows minLength, maxLength, pattern inputs for a string field', () => {
    renderRow(stringField);
    expect(screen.getByLabelText('validation minLength')).toBeTruthy();
    expect(screen.getByLabelText('validation maxLength')).toBeTruthy();
    expect(screen.getByLabelText('validation pattern')).toBeTruthy();
    expect(screen.queryByLabelText('validation min')).toBeNull();
    expect(screen.queryByLabelText('validation max')).toBeNull();
  });

  it('shows message input for all field types', () => {
    renderRow(numericField);
    expect(screen.getByLabelText('validation message')).toBeTruthy();
  });

  it('updates min on numeric field merging existing validation', () => {
    const field: FieldConfig = { ...numericField, validation: { max: 100 } };
    const { onUpdate } = renderRow(field);
    fireEvent.change(screen.getByLabelText('validation min'), { target: { value: '5' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { max: 100, min: 5 } });
  });

  it('updates max on numeric field', () => {
    const { onUpdate } = renderRow(numericField);
    fireEvent.change(screen.getByLabelText('validation max'), { target: { value: '99' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { max: 99 } });
  });

  it('updates minLength on string field', () => {
    const { onUpdate } = renderRow(stringField);
    fireEvent.change(screen.getByLabelText('validation minLength'), { target: { value: '3' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { minLength: 3 } });
  });

  it('updates pattern on string field', () => {
    const { onUpdate } = renderRow(stringField);
    fireEvent.change(screen.getByLabelText('validation pattern'), { target: { value: '^[a-z]+$' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { pattern: '^[a-z]+$' } });
  });

  it('updates message on any field', () => {
    const { onUpdate } = renderRow(numericField);
    fireEvent.change(screen.getByLabelText('validation message'), { target: { value: 'Invalid value' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { message: 'Invalid value' } });
  });

  it('clears a numeric key when input is emptied', () => {
    const field: FieldConfig = { ...numericField, validation: { min: 5, max: 100 } };
    const { onUpdate } = renderRow(field);
    fireEvent.change(screen.getByLabelText('validation min'), { target: { value: '' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { max: 100 } });
  });

  it('shows only message for a boolean field', () => {
    const boolField: FieldConfig = { key: 'active', label: 'Active', component: 'Checkbox', dataType: 'boolean' };
    renderRow(boolField);
    expect(screen.getByLabelText('validation message')).toBeTruthy();
    expect(screen.queryByLabelText('validation min')).toBeNull();
    expect(screen.queryByLabelText('validation minLength')).toBeNull();
  });
});
