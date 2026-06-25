import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldControl } from './field-control';
import type { FieldConfig } from '@rfjs/form-builder';

const inputField: FieldConfig = { key: 'name', label: 'Name', component: 'Input', dataType: 'string' };

describe('FieldControl', () => {
  it('renders an Input and reports changes', () => {
    const onChange = vi.fn();
    render(<FieldControl field={inputField} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada' } });
    expect(onChange).toHaveBeenCalledWith('Ada');
  });

  it('renders a Date input with type=date', () => {
    const field: FieldConfig = { key: 'dob', label: 'DOB', component: 'Date', dataType: 'date' };
    const { container } = render(<FieldControl field={field} value="" onChange={() => {}} />);
    expect(container.querySelector('input[type="date"]')).toBeTruthy();
  });

  it('renders a Checkbox and reports boolean changes', () => {
    const field: FieldConfig = { key: 'agree', label: 'Agree', component: 'Checkbox', dataType: 'boolean' };
    const onChange = vi.fn();
    render(<FieldControl field={field} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
