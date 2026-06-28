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
import {
  FieldRow,
  makeField,
  mergeValidation,
  operatorsFor,
  coerceConditionValue,
  defaultCondition,
  addCondition,
  removeCondition,
  setConditionField,
  setConditionOperator,
  setConditionValue,
  setDataSourceField,
  type SiblingField,
} from './field-row';
import type { FieldConfig, ConditionalRule, DataSource } from '@rfjs/form-builder';

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
    // Use the label text to target the correct checkbox now that there are two (required + conditional)
    fireEvent.click(screen.getByRole('checkbox', { name: /required/i }));
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
  it('renders an aiNote input for the field', () => {
    renderRow(base);
    expect(screen.getByLabelText('AI note for field')).toBeTruthy();
  });
  it('editing the aiNote input calls onUpdate({ aiNote })', () => {
    const { onUpdate } = renderRow(base);
    fireEvent.change(screen.getByLabelText('AI note for field'), {
      target: { value: 'Helpful hint for AI' },
    });
    expect(onUpdate).toHaveBeenCalledWith({ aiNote: 'Helpful hint for AI' });
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

  it('shows the options editor for a Radio field', () => {
    const radioField: FieldConfig = {
      key: 'color', label: 'Color', component: 'Radio', dataType: 'string',
      options: [{ label: 'Red', value: 'red' }],
    };
    renderRow(radioField);
    expect(screen.getByLabelText('option 0 label')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add option/i })).toBeTruthy();
  });
});

describe('Radio options wiring', () => {
  it('makeField seeds/initialises an empty options array for Radio (like Select)', () => {
    const f = makeField('Radio');
    expect(f.component).toBe('Radio');
    expect(f.options).toEqual([]);
  });

  it('a Radio field with options drives the OptionsEditor (add option patches options)', () => {
    const radioField: FieldConfig = {
      key: 'color', label: 'Color', component: 'Radio', dataType: 'string',
      options: [{ label: 'Red', value: 'red' }],
    };
    const { onUpdate } = renderRow(radioField);
    fireEvent.click(screen.getByRole('button', { name: /add option/i }));
    expect(onUpdate).toHaveBeenCalledWith({
      options: [{ label: 'Red', value: 'red' }, { label: '', value: '' }],
    });
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

  it('shows message input when a constraint block is shown', () => {
    renderRow(numericField);
    expect(screen.getByLabelText('validation message')).toBeTruthy();
  });

  it('shows no validation inputs (incl. message) for a Select field with options', () => {
    renderRow(selectField);
    expect(screen.queryByLabelText('validation min')).toBeNull();
    expect(screen.queryByLabelText('validation max')).toBeNull();
    expect(screen.queryByLabelText('validation minLength')).toBeNull();
    expect(screen.queryByLabelText('validation maxLength')).toBeNull();
    expect(screen.queryByLabelText('validation pattern')).toBeNull();
    expect(screen.queryByLabelText('validation message')).toBeNull();
  });

  it('clears a numeric key when input is emptied via the component', () => {
    const field: FieldConfig = { ...numericField, validation: { min: 5, max: 100 } };
    const { onUpdate } = renderRow(field);
    fireEvent.change(screen.getByLabelText('validation min'), { target: { value: '' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { max: 100 } });
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

  it('updates message on a field that shows a constraint block', () => {
    const { onUpdate } = renderRow(numericField);
    fireEvent.change(screen.getByLabelText('validation message'), { target: { value: 'Invalid value' } });
    expect(onUpdate).toHaveBeenCalledWith({ validation: { message: 'Invalid value' } });
  });

  it('shows no validation inputs for a boolean field', () => {
    const boolField: FieldConfig = { key: 'active', label: 'Active', component: 'Checkbox', dataType: 'boolean' };
    renderRow(boolField);
    expect(screen.queryByLabelText('validation message')).toBeNull();
    expect(screen.queryByLabelText('validation min')).toBeNull();
    expect(screen.queryByLabelText('validation minLength')).toBeNull();
  });
});

describe('mergeValidation', () => {
  it('stores a parsed number for a numeric key', () => {
    expect(mergeValidation({ max: 100 }, 'min', '5', true)).toEqual({ max: 100, min: 5 });
  });
  it('clears a numeric key on empty input', () => {
    expect(mergeValidation({ min: 5, max: 100 }, 'min', '', true)).toEqual({ max: 100 });
  });
  it('clears a numeric key (does NOT store NaN) on a non-numeric value', () => {
    expect(mergeValidation({ min: 5, max: 100 }, 'min', 'abc', true)).toEqual({ max: 100 });
  });
  it('stores a string for a string key and clears it on empty', () => {
    expect(mergeValidation(undefined, 'pattern', '^x$', false)).toEqual({ pattern: '^x$' });
    expect(mergeValidation({ pattern: '^x$' }, 'pattern', '', false)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Conditional helpers — pure unit tests
// ---------------------------------------------------------------------------

const strSibling: SiblingField = { key: 'name', label: 'Name', dataType: 'string' };
const numSibling: SiblingField = { key: 'age', label: 'Age', dataType: 'numeric' };
const boolSibling: SiblingField = { key: 'active', label: 'Active', dataType: 'boolean' };
const dateSibling: SiblingField = { key: 'dob', label: 'DOB', dataType: 'date' };

describe('operatorsFor', () => {
  it('returns string operators for string dataType', () => {
    expect(operatorsFor('string')).toEqual(['eq', 'neq', 'contains', 'startswith', 'endswith']);
  });
  it('returns numeric operators for numeric dataType', () => {
    expect(operatorsFor('numeric')).toEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
  });
  it('returns numeric operators for date dataType', () => {
    expect(operatorsFor('date')).toEqual(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);
  });
  it('returns boolean operators for boolean dataType', () => {
    expect(operatorsFor('boolean')).toEqual(['eq', 'neq']);
  });
});

describe('coerceConditionValue', () => {
  it('coerces a valid numeric string to number', () => {
    expect(coerceConditionValue('42', 'numeric')).toBe(42);
  });
  it('returns empty string for empty numeric input', () => {
    expect(coerceConditionValue('', 'numeric')).toBe('');
  });
  it('returns empty string for NaN-producing numeric input (does not store NaN)', () => {
    expect(coerceConditionValue('abc', 'numeric')).toBe('');
  });
  it('coerces "true" string to boolean true', () => {
    expect(coerceConditionValue('true', 'boolean')).toBe(true);
  });
  it('coerces anything else to boolean false for boolean dataType', () => {
    expect(coerceConditionValue('false', 'boolean')).toBe(false);
    expect(coerceConditionValue('yes', 'boolean')).toBe(false);
  });
  it('returns raw string for string dataType', () => {
    expect(coerceConditionValue('hello', 'string')).toBe('hello');
  });
  it('returns raw string for date dataType', () => {
    expect(coerceConditionValue('2024-01-01', 'date')).toBe('2024-01-01');
  });
});

describe('defaultCondition', () => {
  it('creates a condition with operator eq and empty value', () => {
    expect(defaultCondition(strSibling)).toEqual({ field: 'name', dataType: 'string', operator: 'eq', value: '' });
  });
});

describe('addCondition', () => {
  it('creates a new group when called with undefined', () => {
    const result = addCondition(undefined, strSibling);
    expect(result.logic).toBe('and');
    expect(result.filters).toHaveLength(1);
  });
  it('appends a condition to an existing group', () => {
    const group: ConditionalRule = { logic: 'and', filters: [defaultCondition(strSibling) as never] };
    const result = addCondition(group, numSibling);
    expect(result.filters).toHaveLength(2);
  });
  it('preserves the logic of an existing group', () => {
    const group: ConditionalRule = { logic: 'or', filters: [] };
    expect(addCondition(group, strSibling).logic).toBe('or');
  });
});

describe('removeCondition', () => {
  it('removes a condition row at the given index', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [defaultCondition(strSibling) as never, defaultCondition(numSibling) as never],
    };
    const result = removeCondition(group, 0);
    expect(result.filters).toHaveLength(1);
    expect((result.filters[0] as { field: string }).field).toBe('age');
  });
});

describe('setConditionField', () => {
  it('sets the field+dataType and resets operator to eq and clears value', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'name', dataType: 'string', operator: 'contains', value: 'foo' } as never],
    };
    const result = setConditionField(group, 0, numSibling);
    const row = result.filters[0] as { field: string; dataType: string; operator: string; value: string };
    expect(row.field).toBe('age');
    expect(row.dataType).toBe('numeric');
    expect(row.operator).toBe('eq');
    expect(row.value).toBe('');
  });
});

describe('setConditionOperator', () => {
  it('changes only the operator of the given row', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: '' } as never],
    };
    const result = setConditionOperator(group, 0, 'contains');
    expect((result.filters[0] as { operator: string }).operator).toBe('contains');
  });
});

describe('setConditionValue', () => {
  it('stores a numeric value as a number', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 0 } as never],
    };
    const result = setConditionValue(group, 0, '30', 'numeric');
    expect((result.filters[0] as { value: number }).value).toBe(30);
  });
  it('stores empty string (not NaN) for a non-numeric raw value on numeric field', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'age', dataType: 'numeric', operator: 'gt', value: 0 } as never],
    };
    const result = setConditionValue(group, 0, 'abc', 'numeric');
    expect((result.filters[0] as { value: unknown }).value).toBe('');
  });
  it('stores a boolean value for boolean dataType', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'active', dataType: 'boolean', operator: 'eq', value: false } as never],
    };
    const result = setConditionValue(group, 0, 'true', 'boolean');
    expect((result.filters[0] as { value: boolean }).value).toBe(true);
  });
  it('stores raw string for string dataType', () => {
    const group: ConditionalRule = {
      logic: 'and',
      filters: [{ field: 'name', dataType: 'string', operator: 'eq', value: '' } as never],
    };
    const result = setConditionValue(group, 0, 'Alice', 'string');
    expect((result.filters[0] as { value: string }).value).toBe('Alice');
  });
});

// ---------------------------------------------------------------------------
// ConditionalEditor — component tests (driveable parts)
// ---------------------------------------------------------------------------

function renderRowWithSiblings(
  field: FieldConfig,
  siblingFields: SiblingField[],
  onUpdate = vi.fn(),
  onRemove = vi.fn(),
) {
  render(
    <DndContext>
      <SortableContext items={[field.key]}>
        <FieldRow field={field} onUpdate={onUpdate} onRemove={onRemove} siblingFields={siblingFields} />
      </SortableContext>
    </DndContext>,
  );
  return { onUpdate, onRemove };
}

const siblings: SiblingField[] = [
  { key: 'country', label: 'Country', dataType: 'string' },
  { key: 'score', label: 'Score', dataType: 'numeric' },
];

describe('ConditionalEditor — Checkbox toggle', () => {
  it('checking the checkbox calls onUpdate with an empty conditional group', () => {
    const field: FieldConfig = { key: 'city', label: 'City', component: 'Input', dataType: 'string' };
    const { onUpdate } = renderRowWithSiblings(field, siblings);
    // "required" checkbox is first; "enable conditional display" is second
    const conditionalCheckbox = screen.getByLabelText('enable conditional display');
    fireEvent.click(conditionalCheckbox);
    expect(onUpdate).toHaveBeenCalledWith({ conditional: { logic: 'and', filters: [] } });
  });

  it('unchecking the checkbox calls onUpdate with conditional: undefined', () => {
    const field: FieldConfig = {
      key: 'city', label: 'City', component: 'Input', dataType: 'string',
      conditional: { logic: 'and', filters: [] },
    };
    const { onUpdate } = renderRowWithSiblings(field, siblings);
    const conditionalCheckbox = screen.getByLabelText('enable conditional display');
    fireEvent.click(conditionalCheckbox);
    expect(onUpdate).toHaveBeenCalledWith({ conditional: undefined });
  });
});

describe('ConditionalEditor — condition rows', () => {
  const fieldWithCond: FieldConfig = {
    key: 'city',
    label: 'City',
    component: 'Input',
    dataType: 'string',
    conditional: {
      logic: 'and',
      filters: [{ field: 'country', dataType: 'string', operator: 'eq', value: 'US' } as never],
    },
  };

  it('renders the field select trigger with the current field value', () => {
    renderRowWithSiblings(fieldWithCond, siblings);
    const trigger = screen.getByLabelText('condition 0 field');
    expect(trigger.textContent).toContain('Country');
  });

  it('renders the operator select trigger with the current operator', () => {
    renderRowWithSiblings(fieldWithCond, siblings);
    const trigger = screen.getByLabelText('condition 0 operator');
    expect(trigger.textContent).toContain('eq');
  });

  it('editing the value input calls onUpdate with the updated group', () => {
    const { onUpdate } = renderRowWithSiblings(fieldWithCond, siblings);
    fireEvent.change(screen.getByLabelText('condition 0 value'), { target: { value: 'CA' } });
    expect(onUpdate).toHaveBeenCalledWith({
      conditional: {
        logic: 'and',
        filters: [{ field: 'country', dataType: 'string', operator: 'eq', value: 'CA' }],
      },
    });
  });

  it('clicking remove condition calls onUpdate with the condition removed', () => {
    const { onUpdate } = renderRowWithSiblings(fieldWithCond, siblings);
    fireEvent.click(screen.getByLabelText('remove condition 0'));
    expect(onUpdate).toHaveBeenCalledWith({ conditional: { logic: 'and', filters: [] } });
  });

  it('clicking "+ Add condition" calls onUpdate appending a new condition', () => {
    const field: FieldConfig = {
      key: 'city', label: 'City', component: 'Input', dataType: 'string',
      conditional: { logic: 'and', filters: [] },
    };
    const { onUpdate } = renderRowWithSiblings(field, siblings);
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
    expect(onUpdate).toHaveBeenCalledWith({
      conditional: {
        logic: 'and',
        filters: [{ field: 'country', dataType: 'string', operator: 'eq', value: '' }],
      },
    });
  });
});

// ---------------------------------------------------------------------------
// setDataSourceField — pure helper unit tests
// ---------------------------------------------------------------------------

describe('setDataSourceField', () => {
  it('setting url on undefined builds a new dataSource with default extract', () => {
    const result = setDataSourceField(undefined, 'url', 'https://api.test/items');
    expect(result).toEqual({
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
    });
  });

  it('setting url updates request.url on existing dataSource', () => {
    const current: DataSource = {
      request: { url: 'https://old.test' },
      extract: { dialect: 'path', expr: 'data' },
    };
    const result = setDataSourceField(current, 'url', 'https://new.test');
    expect(result?.request.url).toBe('https://new.test');
  });

  it('clearing url returns undefined (empty url clears the whole dataSource)', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
    };
    expect(setDataSourceField(current, 'url', '')).toBeUndefined();
  });

  it('setting dialect updates extract.dialect', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: 'data' },
    };
    const result = setDataSourceField(current, 'dialect', 'jsonata');
    expect(result?.extract.dialect).toBe('jsonata');
    expect(result?.extract.expr).toBe('data'); // preserved
  });

  it('setting expr updates extract.expr', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
    };
    const result = setDataSourceField(current, 'expr', 'items[*].name');
    expect(result?.extract.expr).toBe('items[*].name');
  });

  it('setting optionLabel updates optionLabel', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
    };
    const result = setDataSourceField(current, 'optionLabel', 'name');
    expect(result?.optionLabel).toBe('name');
  });

  it('setting optionValue updates optionValue', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
    };
    const result = setDataSourceField(current, 'optionValue', 'id');
    expect(result?.optionValue).toBe('id');
  });

  it('clearing optionLabel removes the key', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
      optionLabel: 'name',
    };
    const result = setDataSourceField(current, 'optionLabel', '');
    expect(result?.optionLabel).toBeUndefined();
  });

  it('setting fallback updates fallback', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
    };
    const result = setDataSourceField(current, 'fallback', 'N/A');
    expect(result?.fallback).toBe('N/A');
  });

  it('clearing fallback removes the key', () => {
    const current: DataSource = {
      request: { url: 'https://api.test/items' },
      extract: { dialect: 'path', expr: '' },
      fallback: 'N/A',
    };
    const result = setDataSourceField(current, 'fallback', '');
    expect(result?.fallback).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// DataSourceEditor — component tests (driveable parts)
// ---------------------------------------------------------------------------

describe('DataSourceEditor', () => {
  it('editing the url input calls onUpdate with dataSource built from the new url', () => {
    const { onUpdate } = renderRow(base);
    fireEvent.change(screen.getByLabelText('dataSource url'), {
      target: { value: 'https://api.test/items' },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      dataSource: {
        request: { url: 'https://api.test/items' },
        extract: { dialect: 'path', expr: '' },
      },
    });
  });

  it('clearing the url input calls onUpdate with dataSource: undefined', () => {
    const field: FieldConfig = {
      ...base,
      dataSource: {
        request: { url: 'https://api.test/items' },
        extract: { dialect: 'path', expr: '' },
      },
    };
    const { onUpdate } = renderRow(field);
    fireEvent.change(screen.getByLabelText('dataSource url'), { target: { value: '' } });
    expect(onUpdate).toHaveBeenCalledWith({ dataSource: undefined });
  });

  it('shows optionLabel and optionValue inputs for Select fields', () => {
    renderRow(selectField);
    expect(screen.getByLabelText('dataSource optionLabel')).toBeTruthy();
    expect(screen.getByLabelText('dataSource optionValue')).toBeTruthy();
  });

  it('shows optionLabel and optionValue inputs for Radio fields', () => {
    const radioField: FieldConfig = {
      key: 'color', label: 'Color', component: 'Radio', dataType: 'string',
      options: [{ label: 'Red', value: 'red' }],
    };
    renderRow(radioField);
    expect(screen.getByLabelText('dataSource optionLabel')).toBeTruthy();
    expect(screen.getByLabelText('dataSource optionValue')).toBeTruthy();
  });

  it('does not show optionLabel/optionValue for non-Select/Radio fields', () => {
    renderRow(base); // base = Input
    expect(screen.queryByLabelText('dataSource optionLabel')).toBeNull();
    expect(screen.queryByLabelText('dataSource optionValue')).toBeNull();
  });

  it('editing the expr input calls onUpdate with updated extract.expr', () => {
    const field: FieldConfig = {
      ...base,
      dataSource: {
        request: { url: 'https://api.test/items' },
        extract: { dialect: 'path', expr: '' },
      },
    };
    const { onUpdate } = renderRow(field);
    fireEvent.change(screen.getByLabelText('dataSource expr'), { target: { value: 'data.items' } });
    expect(onUpdate).toHaveBeenCalledWith({
      dataSource: {
        request: { url: 'https://api.test/items' },
        extract: { dialect: 'path', expr: 'data.items' },
      },
    });
  });
});
