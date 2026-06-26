import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigForm } from './config-form';
import type { FormConfig } from '@rfjs/form-builder';

const baseConfig: FormConfig = {
  version: 1,
  fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }],
};

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

describe('localized labels', () => {
  const cfg: FormConfig = {
    version: 1,
    fields: [{ key: 'name', label: { en: 'Name', 'zh-TW': '姓名' }, component: 'Input', dataType: 'string' }],
  };
  it('renders the label for the given locale', () => {
    render(<ConfigForm config={cfg} locale="zh-TW" onSubmit={() => {}} />);
    expect(screen.getByText('姓名')).toBeTruthy();
  });
  it('defaults to the en label', () => {
    render(<ConfigForm config={cfg} onSubmit={() => {}} />);
    expect(screen.getByText('Name')).toBeTruthy();
  });
});

describe('config reactivity', () => {
  it('renders the new field set after config changes without remounting existing inputs', () => {
    const extendedConfig: FormConfig = {
      version: 1,
      fields: [
        { key: 'name', label: 'Name', component: 'Input', dataType: 'string' },
        { key: 'email', label: 'Email', component: 'Input', dataType: 'string' },
      ],
    };

    const { rerender } = render(<ConfigForm config={baseConfig} onSubmit={() => {}} />);

    // Record the input node for the existing 'name' field before rerender
    const nameInputBefore = screen.getByRole('textbox', { name: 'Name' });

    // Only 'Name' field should be present initially
    expect(screen.queryByText('Email')).toBeNull();

    // Rerender with an extended config that adds 'email' field
    rerender(<ConfigForm config={extendedConfig} onSubmit={() => {}} />);

    // The new 'Email' field should appear
    expect(screen.getByText('Email')).toBeTruthy();

    // The existing 'name' input node must be the SAME DOM element — no remount
    const nameInputAfter = screen.getByRole('textbox', { name: 'Name' });
    expect(nameInputAfter).toBe(nameInputBefore);
  });

  it('accepts a config change that removes the required constraint on a field', async () => {
    // Start with a required 'name' field
    const requiredConfig: FormConfig = {
      version: 1,
      fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }],
    };
    // Change to the same field but optional
    const optionalConfig: FormConfig = {
      version: 1,
      fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: false }],
    };

    const onSubmit = vi.fn();
    const { rerender } = render(<ConfigForm config={requiredConfig} onSubmit={onSubmit} />);

    // Submitting with empty 'name' should be blocked (required)
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());

    // Now change config to remove the required constraint
    rerender(<ConfigForm config={optionalConfig} onSubmit={onSubmit} />);

    // Submitting with empty 'name' should now succeed (field is optional)
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });
});

describe('field validation messages', () => {
  const minLenConfig: FormConfig = {
    version: 1,
    fields: [
      {
        key: 'username',
        label: 'Username',
        component: 'Input',
        dataType: 'string',
        validation: { minLength: 3, message: 'At least 3 characters' },
      },
    ],
  };

  it('shows the validation message after submitting an invalid value', async () => {
    render(<ConfigForm config={minLenConfig} onSubmit={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText('At least 3 characters')).toBeTruthy());
  });

  it('does not show a validation message when the value is valid', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={minLenConfig} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), { target: { value: 'ada' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.queryByText('At least 3 characters')).toBeNull();
  });

  it('shows a minLength message when the value is too short after typing', async () => {
    render(<ConfigForm config={minLenConfig} onSubmit={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(screen.getByText('At least 3 characters')).toBeTruthy());
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
