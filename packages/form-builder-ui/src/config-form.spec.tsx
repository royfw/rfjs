import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigForm } from './config-form';
import type { FormConfig } from '@rfjs/form-builder';

const config: FormConfig = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string' },
  ],
};

describe('ConfigForm', () => {
  it('renders a label and control per field', () => {
    render(<ConfigForm config={config} onSubmit={() => {}} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Bio')).toBeTruthy();
  });

  it('blocks submit and shows no payload when a required field is empty', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={config} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('submits the typed values when valid', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={config} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada', bio: undefined }));
  });
});

describe('grid layout', () => {
  const gridConfig: FormConfig = {
    version: 1,
    columns: 2,
    fields: [
      { key: 'name', label: 'Name', component: 'Input', dataType: 'string', width: 'half' },
      { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string', width: 'full' },
    ],
  };

  it('sets the form column count from config.columns', () => {
    const { container } = render(<ConfigForm config={gridConfig} onSubmit={() => {}} />);
    const form = container.querySelector('form')!;
    expect(form.getAttribute('data-columns')).toBe('2');
    expect(form.style.getPropertyValue('--form-cols')).toBe('2');
  });

  it('spans full-width fields across all columns and leaves half fields in one cell', () => {
    const { container } = render(<ConfigForm config={gridConfig} onSubmit={() => {}} />);
    const half = container.querySelector('[data-width="half"]') as HTMLElement;
    const full = container.querySelector('[data-width="full"]') as HTMLElement;
    expect(half.style.gridColumn).toBe('');
    expect(full.style.gridColumn).toBe('1 / -1');
  });

  it('defaults to a single column when config.columns is absent', () => {
    const cfg: FormConfig = { version: 1, fields: [{ key: 'a', label: 'A', component: 'Input', dataType: 'string' }] };
    const { container } = render(<ConfigForm config={cfg} onSubmit={() => {}} />);
    expect(container.querySelector('form')!.getAttribute('data-columns')).toBe('1');
    // a field with no explicit width defaults to full → spans the single column
    expect((container.querySelector('[data-width="full"]') as HTMLElement).style.gridColumn).toBe('1 / -1');
  });
});
