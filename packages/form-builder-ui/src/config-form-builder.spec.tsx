import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConfigFormBuilder } from './config-form-builder';
import type { FormConfig } from '@rfjs/form-builder';

const initial: FormConfig = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };

describe('ConfigFormBuilder', () => {
  it('adds a field from the palette', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /add input/i }));
    // two label inputs now exist in the editor (Name + the new Input)
    expect(screen.getAllByLabelText(/^label for /).length).toBe(2);
  });

  it('renders a live preview of the current config', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    const preview = screen.getByTestId('config-form-preview');
    // the preview renders the field's label text
    expect(within(preview).getByText('Name')).toBeTruthy();
  });

  it('removes a field', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    fireEvent.click(screen.getByRole('button', { name: /remove field/i }));
    expect(screen.queryByLabelText('label for name')).toBeNull();
  });

  it('sets form columns from the columns control', () => {
    const onChange = vi.fn();
    render(<ConfigFormBuilder initialConfig={initial} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/columns/i), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ columns: 2 }));
  });

  it('shows the config as JSON and applies edits back (round-trip)', () => {
    const onChange = vi.fn();
    render(<ConfigFormBuilder initialConfig={initial} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /json/i }));
    const ta = screen.getByLabelText(/config json/i) as HTMLTextAreaElement;
    const next = { version: 1, fields: [{ key: 'email', label: 'Email', component: 'Input', dataType: 'string' }] };
    fireEvent.change(ta, { target: { value: JSON.stringify(next) } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fields: [expect.objectContaining({ key: 'email' })] }));
  });

  it('shows an error for invalid JSON and does not apply it', () => {
    const onChange = vi.fn();
    render(<ConfigFormBuilder initialConfig={initial} onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /json/i }));
    fireEvent.change(screen.getByLabelText(/config json/i), { target: { value: '{ not json' } });
    expect(screen.getByText(/invalid/i)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
