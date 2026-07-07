import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConfigForm } from './config-form';
import type { FormConfig, DataSource, UploadHandler, FileRef, SignatureTransport, ButtonAction, ButtonItem } from '@rfjs/form-builder';

// ---------------------------------------------------------------------------
// Controllable ResizeObserver mock (used by responsive tests below).
// installResizeObserverMock() registers a beforeEach that installs the mock
// and returns a fireWidth helper — the callback is a closure inside the
// function so no module-level state leaks between describe blocks.
// ---------------------------------------------------------------------------
function installResizeObserverMock() {
  let roCb: (entries: any[]) => void = () => {};
  beforeEach(() => {
    roCb = () => {};
    (globalThis as any).ResizeObserver = class {
      constructor(cb: any) { roCb = cb; }
      observe() {}
      disconnect() {}
    };
  });
  return {
    fireWidth(width: number) {
      act(() => roCb([{ contentRect: { width } }]));
    },
  };
}


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
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data).toEqual({ name: 'Ada', bio: undefined });
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

describe('localized description', () => {
  const cfg: FormConfig = {
    version: 1,
    fields: [{
      key: 'name',
      label: { en: 'Name', 'zh-TW': '姓名' },
      description: { en: 'Enter your name', 'zh-TW': '請輸入姓名' },
      component: 'Input',
      dataType: 'string',
    }],
  };
  it('resolves description to zh-TW when locale=zh-TW', () => {
    render(<ConfigForm config={cfg} locale="zh-TW" onSubmit={() => {}} />);
    expect(screen.getByText('請輸入姓名')).toBeTruthy();
    expect(screen.queryByText('Enter your name')).toBeNull();
  });
  it('resolves description to English when no locale is given', () => {
    render(<ConfigForm config={cfg} onSubmit={() => {}} />);
    expect(screen.getByText('Enter your name')).toBeTruthy();
    expect(screen.queryByText('請輸入姓名')).toBeNull();
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

describe('conditional show/hide', () => {
  // Controlling field is a plain text Input so fireEvent.change works in jsdom
  const conditionalConfig: FormConfig = {
    version: 1,
    fields: [
      { key: 'role', label: 'Role', component: 'Input', dataType: 'string' },
      {
        key: 'adminCode',
        label: 'Admin Code',
        component: 'Input',
        dataType: 'string',
        conditional: {
          logic: 'and',
          filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
        },
      },
    ],
  };

  it('hides a conditional field when the controlling field does not satisfy the rule', () => {
    render(<ConfigForm config={conditionalConfig} onSubmit={() => {}} />);
    // role is empty → adminCode should not be in the DOM
    expect(screen.queryByLabelText('Admin Code')).toBeNull();
  });

  it('shows the conditional field when the controlling field satisfies the rule', async () => {
    render(<ConfigForm config={conditionalConfig} onSubmit={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Role' }), { target: { value: 'admin' } });
    await waitFor(() => expect(screen.getByLabelText('Admin Code')).toBeTruthy());
  });

  it('hides the conditional field again when the controlling field changes away from the trigger value', async () => {
    render(<ConfigForm config={conditionalConfig} onSubmit={() => {}} />);
    const roleInput = screen.getByRole('textbox', { name: 'Role' });
    fireEvent.change(roleInput, { target: { value: 'admin' } });
    await waitFor(() => expect(screen.getByLabelText('Admin Code')).toBeTruthy());
    fireEvent.change(roleInput, { target: { value: 'user' } });
    await waitFor(() => expect(screen.queryByLabelText('Admin Code')).toBeNull());
  });

  it('does not block submit when a hidden required field is empty', async () => {
    const requiredConditionalConfig: FormConfig = {
      version: 1,
      fields: [
        { key: 'role', label: 'Role', component: 'Input', dataType: 'string' },
        {
          key: 'adminCode',
          label: 'Admin Code',
          component: 'Input',
          dataType: 'string',
          required: true,
          conditional: {
            logic: 'and',
            filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
          },
        },
      ],
    };
    const onSubmit = vi.fn();
    render(<ConfigForm config={requiredConditionalConfig} onSubmit={onSubmit} />);
    // role !== 'admin' → adminCode hidden; even though it's required, submit should succeed
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  });

  it('blocks submit when a visible required conditional field is empty', async () => {
    const requiredConditionalConfig: FormConfig = {
      version: 1,
      fields: [
        { key: 'role', label: 'Role', component: 'Input', dataType: 'string' },
        {
          key: 'adminCode',
          label: 'Admin Code',
          component: 'Input',
          dataType: 'string',
          required: true,
          conditional: {
            logic: 'and',
            filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
          },
        },
      ],
    };
    const onSubmit = vi.fn();
    render(<ConfigForm config={requiredConditionalConfig} onSubmit={onSubmit} />);
    // Make adminCode visible by setting role = 'admin'
    fireEvent.change(screen.getByRole('textbox', { name: 'Role' }), { target: { value: 'admin' } });
    await waitFor(() => expect(screen.getByLabelText('Admin Code')).toBeTruthy());
    // Submit without filling adminCode → should be blocked
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled());
  });

  it('strips hidden field values from the submit payload', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={conditionalConfig} onSubmit={onSubmit} />);
    const roleInput = screen.getByRole('textbox', { name: 'Role' });
    // Make adminCode visible and fill it
    fireEvent.change(roleInput, { target: { value: 'admin' } });
    await waitFor(() => expect(screen.getByLabelText('Admin Code')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox', { name: 'Admin Code' }), { target: { value: 'secret' } });
    // Now hide it by changing role
    fireEvent.change(roleInput, { target: { value: 'user' } });
    await waitFor(() => expect(screen.queryByLabelText('Admin Code')).toBeNull());
    // Submit → payload should NOT contain adminCode
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data).not.toHaveProperty('adminCode');
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

describe('content item dataSource', () => {
  const ds: DataSource = {
    request: { url: 'https://example.com/api/value' },
    extract: { dialect: 'path', expr: 'result' },
    fallback: '—',
  };

  function makeCfg(dataSource?: DataSource): FormConfig {
    return {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            {
              id: 'r1',
              items: [{ id: 'c1', kind: 'content', text: 'Static text', ...(dataSource ? { dataSource } : {}) }],
            },
          ],
        },
      ],
    } as unknown as FormConfig;
  }

  it('shows the fetched value when dataSource resolves', async () => {
    const fetcher = vi.fn().mockResolvedValue({ result: 'Fetched Value' });
    render(<ConfigForm config={makeCfg(ds)} fetcher={fetcher} onSubmit={() => {}} />);
    await waitFor(() => expect(screen.getByText('Fetched Value')).toBeTruthy());
  });

  it('shows the fallback when the fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<ConfigForm config={makeCfg(ds)} fetcher={fetcher} onSubmit={() => {}} />);
    await waitFor(() => expect(screen.getByText('—')).toBeTruthy());
  });

  it('shows the default fallback (無) when ds has no fallback and fetcher rejects', async () => {
    const dsNoFallback: DataSource = { request: { url: '/api' }, extract: { dialect: 'path', expr: 'v' } };
    const fetcher = vi.fn().mockRejectedValue(new Error('fail'));
    render(<ConfigForm config={makeCfg(dsNoFallback)} fetcher={fetcher} onSubmit={() => {}} />);
    await waitFor(() => expect(screen.getByText('無')).toBeTruthy());
  });

  it('shows the static text when no dataSource is present', () => {
    render(<ConfigForm config={makeCfg()} onSubmit={() => {}} />);
    expect(screen.getByText('Static text')).toBeTruthy();
  });
});

describe('v2 sections rendering', () => {
  it('renders a v2 sections config: field control + content + divider; ai-note absent', () => {
    const cfg = { version: 1, sections: [{ id: 's1', title: 'Profile', rows: [
      { id: 'r1', items: [{ id: 'name', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] },
      { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'Please fill in' }, { id: 'div', kind: 'divider' }] },
      { id: 'r3', items: [{ id: 'note', kind: 'ai-note', text: 'internal' }] },
    ] }] };
    render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
    expect(screen.getByText('Please fill in')).toBeTruthy();
    expect(screen.queryByText('internal')).toBeNull(); // ai-note never rendered
  });

  it('hides a content item whose conditional is false', () => {
    const cfg = { version: 1, sections: [{ id: 's1', rows: [
      { id: 'r1', items: [{ id: 'role', kind: 'field', key: 'role', label: 'Role', component: 'Input', dataType: 'string' }] },
      { id: 'r2', items: [{ id: 'c', kind: 'content', text: 'admin only', conditional: { logic: 'and', filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }] } }] },
    ] }] };
    render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    expect(screen.queryByText('admin only')).toBeNull();
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'admin' } });
    expect(screen.getByText('admin only')).toBeTruthy();
  });

  it('still renders a v1 fields[] config unchanged (back-compat)', () => {
    const cfg = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };
    render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    expect(screen.getByLabelText('Name')).toBeTruthy();
  });

  it('puts two items of one v2 row in a single grid container, and a second row in its own', () => {
    const cfg = { version: 1, sections: [{ id: 's1', rows: [
      { id: 'r1', items: [
        { id: 'first', kind: 'field', key: 'first', label: 'First', component: 'Input', dataType: 'string', width: 'half' },
        { id: 'last', kind: 'field', key: 'last', label: 'Last', component: 'Input', dataType: 'string', width: 'half' },
      ] },
      { id: 'r2', items: [
        { id: 'email', kind: 'field', key: 'email', label: 'Email', component: 'Input', dataType: 'string' },
      ] },
    ] }] };
    const { container } = render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    const rows = container.querySelectorAll('[data-testid="form-row"]');
    expect(rows).toHaveLength(2);
    // both half-width fields share the first row container
    expect(rows[0]!.querySelectorAll('[data-width="half"]')).toHaveLength(2);
    expect(screen.getByLabelText('First')).toBeTruthy();
    expect(screen.getByLabelText('Last')).toBeTruthy();
    // the second row's item is in a distinct container; an unset width is now "auto" (#3)
    expect(rows[1]!.querySelector('[data-width="auto"]')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('derives field span from the section column count (#3: columns drive width)', () => {
    // A 2-column section with two unset-width fields → each occupies one cell
    // (span 1) and the row is a 2-col grid. No per-field width needed.
    const cfg = { version: 1, sections: [{ id: 's1', columns: 2, rows: [
      { id: 'r1', items: [
        { id: 'a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' },
        { id: 'b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' },
      ] },
      { id: 'r2', items: [
        { id: 'c', kind: 'field', key: 'c', label: 'C', component: 'Input', dataType: 'string', width: 'full' },
      ] },
    ] }] };
    const { container } = render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    const rows = container.querySelectorAll('[data-testid="form-row"]');
    // Row grid is driven by the section's columns.
    expect((rows[0] as HTMLElement).style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
    // Unset-width fields span a single cell; a full field spans the whole row.
    const a = container.querySelector('[data-width="auto"]') as HTMLElement;
    expect(a.style.gridColumn).toBe('span 1 / span 1');
    const c = container.querySelector('[data-width="full"]') as HTMLElement;
    expect(c.style.gridColumn).toBe('1 / -1');
  });
});

describe('grid-layout sections', () => {
  const cfg = {
    version: 1,
    sections: [
      {
        id: 's1',
        rows: [{ id: 'r1', items: [
          { id: 'i_a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' },
          { id: 'i_b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' },
        ] }],
        layout: { columns: 12, placements: [
          { itemId: 'i_a', colStart: 1, colSpan: 7, row: 1 },
          { itemId: 'i_b', colStart: 8, colSpan: 5, row: 1 },
        ] },
      },
    ],
  };

  it('renders a layout section as one grid, positioning items by placement', () => {
    const { container } = render(<ConfigForm config={cfg as any} onSubmit={() => {}} />);
    const grid = container.querySelector('[data-testid="form-grid"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
    const a = container.querySelector('[data-item="i_a"]') as HTMLElement;
    const b = container.querySelector('[data-item="i_b"]') as HTMLElement;
    expect(a.style.gridColumn).toBe('1 / span 7');
    expect(b.style.gridColumn).toBe('8 / span 5');
    expect(a.style.gridRow).toBe('1');
  });
});

describe('FileUpload field', () => {
  const fileUploadConfig: FormConfig = {
    version: 1,
    fields: [
      {
        key: 'doc',
        label: 'Document',
        component: 'FileUpload',
        dataType: 'string',
        fileUpload: { accept: 'application/pdf', multiple: false, maxSize: 1024 },
      },
    ],
  };

  it('shows a disabled fallback when no uploadHandler is provided', () => {
    render(<ConfigForm config={fileUploadConfig} onSubmit={() => {}} />);
    // The fallback must render BOTH a message AND a disabled input.
    const fallbackMsg = screen.queryByText(/no upload handler/i);
    expect(fallbackMsg).toBeTruthy();
    // The disabled file input must be present inside the fallback container.
    const fallbackInput = fallbackMsg!.closest('div')!.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fallbackInput).toBeTruthy();
    expect(fallbackInput!.disabled).toBe(true);
  });

  it('stores a FileRef when uploadHandler resolves', async () => {
    const fileRef: FileRef = { name: 'test.pdf', size: 500, type: 'application/pdf', url: 'u' };
    const uploadHandler: UploadHandler = vi.fn(async () => fileRef);
    const onSubmit = vi.fn();

    render(
      <ConfigForm
        config={fileUploadConfig}
        onSubmit={onSubmit}
        uploadHandler={uploadHandler}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 500 });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadHandler).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const payload = onSubmit.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(payload.data).toEqual({ doc: fileRef });
  });

  it('calls onFileError when uploadHandler rejects', async () => {
    const uploadHandler: UploadHandler = vi.fn().mockRejectedValue(new Error('Server error'));
    const onSubmit = vi.fn();

    render(
      <ConfigForm
        config={fileUploadConfig}
        onSubmit={onSubmit}
        uploadHandler={uploadHandler}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 500 });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadHandler).toHaveBeenCalledOnce());
    // The error message from the rejected handler should surface in the form
    await waitFor(() => expect(screen.getByText(/server error/i)).toBeTruthy());
  });

  it('rejects a file over maxSize at pick time and keeps value empty', async () => {
    const uploadHandler: UploadHandler = vi.fn(async (f) => ({
      name: f.name, size: f.size, type: f.type,
    }));
    const onSubmit = vi.fn();

    render(
      <ConfigForm
        config={fileUploadConfig}
        onSubmit={onSubmit}
        uploadHandler={uploadHandler}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create a file that exceeds maxSize (1024 bytes)
    const bigFile = new File(['x'.repeat(2048)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 2048 });

    fireEvent.change(input, { target: { files: [bigFile] } });

    // uploadHandler must NOT be called for the oversized file
    await waitFor(() => expect(uploadHandler).not.toHaveBeenCalled());

    // An error message should appear
    const errMsg = await screen.findByText(/size|too large|max/i);
    expect(errMsg).toBeTruthy();
  });
});

describe('Signature field submit gating', () => {
  const signatureConfig: FormConfig = {
    version: 1,
    fields: [
      { key: 'sig', label: 'Signature', component: 'Signature', dataType: 'string' },
    ],
  };

  it('disables the submit button while signature capture status is pending', async () => {
    const cancelFn = vi.fn();
    const signatureTransport: SignatureTransport = vi.fn(() => ({
      result: new Promise<string>(() => {}), // never resolves — keeps status 'pending'
      cancel: cancelFn,
    }));

    render(
      <ConfigForm
        config={signatureConfig}
        onSubmit={() => {}}
        signatureTransport={signatureTransport}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /submit/i });

    // Before capture starts the submit button is enabled
    expect(submitBtn.hasAttribute('disabled')).toBe(false);

    // Click "Capture signature" to start the pending capture session
    const captureBtn = screen.getByRole('button', { name: /capture signature/i });
    fireEvent.click(captureBtn);

    // The submit button must be disabled while status === 'pending'
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(true));
  });

  it('re-enables submit when a pending Signature field is conditionally hidden (unmount clears pendingCaptures)', async () => {
    const conditionalSigConfig: FormConfig = {
      version: 1,
      fields: [
        { key: 'role', label: 'Role', component: 'Input', dataType: 'string' },
        {
          key: 'sig',
          label: 'Signature',
          component: 'Signature',
          dataType: 'string',
          conditional: {
            logic: 'and',
            filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'show' }],
          },
        },
      ],
    };

    const signatureTransport: SignatureTransport = vi.fn(() => ({
      result: new Promise<string>(() => {}), // never resolves — keeps status 'pending'
      cancel: vi.fn(),
    }));

    render(
      <ConfigForm
        config={conditionalSigConfig}
        onSubmit={() => {}}
        signatureTransport={signatureTransport}
      />,
    );

    const roleInput = screen.getByRole('textbox', { name: 'Role' });
    const submitBtn = screen.getByRole('button', { name: /submit/i });

    // Show the Signature field
    fireEvent.change(roleInput, { target: { value: 'show' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /capture signature/i })).toBeTruthy());

    // Start a pending capture — submit becomes disabled
    fireEvent.click(screen.getByRole('button', { name: /capture signature/i }));
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(true));

    // Hide the Signature field by changing the controlling field — field unmounts
    fireEvent.change(roleInput, { target: { value: 'hide' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /capture signature/i })).toBeNull());

    // Submit must no longer be disabled — pendingCaptures cleared on unmount
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(false));
  });

  it('re-enables submit when config changes and removes a pending Signature field', async () => {
    const signatureTransport: SignatureTransport = vi.fn(() => ({
      result: new Promise<string>(() => {}), // never resolves — keeps status 'pending'
      cancel: vi.fn(),
    }));

    const { rerender } = render(
      <ConfigForm
        config={signatureConfig}
        onSubmit={() => {}}
        signatureTransport={signatureTransport}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /submit/i });

    // Start a pending capture — submit becomes disabled
    fireEvent.click(screen.getByRole('button', { name: /capture signature/i }));
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(true));

    // Replace config with one that has no Signature field
    rerender(<ConfigForm config={baseConfig} onSubmit={() => {}} signatureTransport={signatureTransport} />);

    // Submit must no longer be disabled — pendingCaptures cleared on config change
    await waitFor(() => expect(submitBtn.hasAttribute('disabled')).toBe(false));
  });
});

// ---------------------------------------------------------------------------
// onPayloadChange — live payload seam
// ---------------------------------------------------------------------------

describe('onPayloadChange', () => {
  it('emits live payload (data + meta) on value change without submit', async () => {
    const onPayloadChange = vi.fn();
    const cfg: FormConfig = {
      version: 1,
      fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }],
    };
    render(<ConfigForm config={cfg} onSubmit={() => {}} onPayloadChange={onPayloadChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Ann' } });
    await waitFor(() => {
      const lastCall = onPayloadChange.mock.calls.at(-1)![0];
      expect(lastCall.data.name).toBe('Ann');
      expect(lastCall.meta.visibleKeys).toContain('name');
    });
  });

  it('excludes conditionally-hidden fields from payload data and visibleKeys', async () => {
    const onPayloadChange = vi.fn();
    const cfg: FormConfig = {
      version: 1,
      fields: [
        { key: 'role', label: 'Role', component: 'Input', dataType: 'string' },
        {
          key: 'secret',
          label: 'Secret',
          component: 'Input',
          dataType: 'string',
          conditional: {
            logic: 'and',
            filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
          },
        },
      ],
    };
    render(<ConfigForm config={cfg} onSubmit={() => {}} onPayloadChange={onPayloadChange} />);
    // role !== 'admin' → secret is hidden
    fireEvent.change(screen.getByRole('textbox', { name: 'Role' }), { target: { value: 'user' } });
    await waitFor(() => {
      const lastCall = onPayloadChange.mock.calls.at(-1)![0];
      expect(Object.keys(lastCall.data)).not.toContain('secret');
      expect(lastCall.meta.visibleKeys).not.toContain('secret');
    });
  });

  it('reports meta.valid=true when a hidden required field is empty (excluded from meta validation, consistent with submit)', async () => {
    const onPayloadChange = vi.fn();
    const cfg: FormConfig = {
      version: 1,
      fields: [
        { key: 'role', label: 'Role', component: 'Input', dataType: 'string' },
        {
          key: 'adminCode',
          label: 'Admin Code',
          component: 'Input',
          dataType: 'string',
          required: true,
          conditional: {
            logic: 'and',
            filters: [{ field: 'role', dataType: 'string', operator: 'eq', value: 'admin' }],
          },
        },
      ],
    };
    render(<ConfigForm config={cfg} onSubmit={() => {}} onPayloadChange={onPayloadChange} />);
    // role !== 'admin' → adminCode is hidden; even though it's required, the form would submit
    // → meta.valid must be true (no visible required fields are failing)
    await waitFor(() => expect(onPayloadChange).toHaveBeenCalled());
    const lastCall = onPayloadChange.mock.calls.at(-1)![0];
    expect(lastCall.meta.valid).toBe(true);
    expect(lastCall.meta.visibleKeys).not.toContain('adminCode');
  });

  it('reports meta.valid=false and errors when a required field is empty', async () => {
    const onPayloadChange = vi.fn();
    const cfg: FormConfig = {
      version: 1,
      fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true }],
    };
    render(<ConfigForm config={cfg} onSubmit={() => {}} onPayloadChange={onPayloadChange} />);
    // Trigger a re-render by typing then clearing — or just wait for the initial emit
    await waitFor(() => expect(onPayloadChange).toHaveBeenCalled());
    const lastCall = onPayloadChange.mock.calls.at(-1)![0];
    expect(lastCall.meta.valid).toBe(false);
    expect(lastCall.meta.errors).toHaveProperty('name');
  });
});

// ---------------------------------------------------------------------------
// Responsive collapse (container-driven via ResizeObserver)
// ---------------------------------------------------------------------------

describe('responsive container collapse', () => {
  const { fireWidth } = installResizeObserverMock();

  const gridCfg = {
    version: 1,
    sections: [
      {
        id: 's1',
        rows: [{ id: 'r1', items: [
          { id: 'i_a', kind: 'field', key: 'a', label: 'A', component: 'Input', dataType: 'string' },
          { id: 'i_b', kind: 'field', key: 'b', label: 'B', component: 'Input', dataType: 'string' },
        ] }],
        layout: { columns: 12, placements: [
          { itemId: 'i_a', colStart: 1, colSpan: 7, row: 1 },
          { itemId: 'i_b', colStart: 8, colSpan: 5, row: 1 },
        ] },
      },
    ],
  } as any as FormConfig;

  it('collapses grid-mode section to single column when container is narrow', () => {
    const { container } = render(<ConfigForm config={gridCfg} onSubmit={() => {}} />);
    // trigger narrow width (< default 640)
    fireWidth(400);
    const grid = container.querySelector('[data-testid="form-grid"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('1fr');
    const a = container.querySelector('[data-item="i_a"]') as HTMLElement;
    const b = container.querySelector('[data-item="i_b"]') as HTMLElement;
    expect(a.style.gridColumn).toBe('1 / -1');
    expect(b.style.gridColumn).toBe('1 / -1');
  });

  it('keeps multi-column layout when container is wide (>= default stackBelow 640)', () => {
    const { container } = render(<ConfigForm config={gridCfg} onSubmit={() => {}} />);
    // First go narrow to confirm collapsed state…
    fireWidth(400);
    const grid = container.querySelector('[data-testid="form-grid"]') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('1fr');
    // …then fire a wide width to confirm restoration.
    fireWidth(900);
    expect(grid.style.gridTemplateColumns).toContain('repeat(');
    const a = container.querySelector('[data-item="i_a"]') as HTMLElement;
    // in wide mode the placement span is restored
    expect(a.style.gridColumn).toBe('1 / span 7');
  });

  it('honors config.responsive.stackBelow override (480)', () => {
    const cfg: FormConfig = {
      ...(gridCfg as any),
      responsive: { stackBelow: 480 },
    } as any;
    const { container } = render(<ConfigForm config={cfg} onSubmit={() => {}} />);
    // width=520 — above the 480 threshold → wide, multi-column preserved
    fireWidth(520);
    const grid1 = container.querySelector('[data-testid="form-grid"]') as HTMLElement;
    expect(grid1.style.gridTemplateColumns).toContain('repeat(');
    // width=400 — below 480 threshold → narrow, collapsed
    fireWidth(400);
    const grid2 = container.querySelector('[data-testid="form-grid"]') as HTMLElement;
    expect(grid2.style.gridTemplateColumns).toBe('1fr');
  });

  it('collapses outer form grid and flow-section rows when narrow', () => {
    const flowCfg: FormConfig = {
      version: 1,
      columns: 2,
      sections: [
        {
          id: 's1',
          columns: 2,
          rows: [
            { id: 'r1', items: [
              { id: 'f1', kind: 'field', key: 'x', label: 'X', component: 'Input', dataType: 'string' },
              { id: 'f2', kind: 'field', key: 'y', label: 'Y', component: 'Input', dataType: 'string' },
            ] },
          ],
        },
      ],
    } as any;
    const { container } = render(<ConfigForm config={flowCfg} onSubmit={() => {}} />);
    fireWidth(300);
    const form = container.querySelector('form') as HTMLElement;
    expect(form.style.gridTemplateColumns).toBe('1fr');
    const row = container.querySelector('[data-testid="form-row"]') as HTMLElement;
    expect(row.style.gridTemplateColumns).toBe('1fr');
  });

  it('orphaned items (no placement) sort after all placed items in narrow mode', () => {
    const orphanCfg = {
      version: 1,
      sections: [
        {
          id: 's1',
          rows: [
            { id: 'r1', items: [
              { id: 'placed', kind: 'field', key: 'placed', label: 'Placed', component: 'Input', dataType: 'string' },
            ] },
            { id: 'r2', items: [
              { id: 'orphan', kind: 'field', key: 'orphan', label: 'Orphan', component: 'Input', dataType: 'string' },
            ] },
          ],
          // Only 'placed' has a placement; 'orphan' has none.
          layout: { columns: 12, placements: [
            { itemId: 'placed', colStart: 1, colSpan: 12, row: 1 },
          ] },
        },
      ],
    } as any as FormConfig;
    const { container } = render(<ConfigForm config={orphanCfg} onSubmit={() => {}} />);
    fireWidth(400); // go narrow → sort kicks in
    const items = container.querySelectorAll('[data-item]');
    // placed item (row 1) must appear before orphan (MAX_SAFE_INTEGER fallback)
    expect(items[0]!.getAttribute('data-item')).toBe('placed');
    expect(items[1]!.getAttribute('data-item')).toBe('orphan');
  });
});

describe('action meta envelope', () => {
  const cfg: FormConfig = {
    version: 1,
    id: 'leave-form',
    meta: { source: 'web' },
    fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }],
  };

  it('default submit emits { data, meta } with formId/timestamp/action/custom', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={cfg} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Roy' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]![0] as { data: Record<string, unknown>; meta: Record<string, unknown> };
    expect(payload.data).toEqual({ name: 'Roy' });
    expect(payload.meta).toMatchObject({
      formId: 'leave-form',
      action: { type: 'submit' },
      custom: { source: 'web' },
      valid: true,
      schemaVersion: 1,
    });
    expect(typeof payload.meta.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(payload.meta.timestamp as string))).toBe(false);
  });

  it('metaProvider values merge in but cannot override reserved keys', async () => {
    const onSubmit = vi.fn();
    render(
      <ConfigForm
        config={cfg}
        onSubmit={onSubmit}
        metaProvider={() => ({ user: 'roy', action: 'HACKED', timestamp: 'HACKED' })}
      />,
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const meta = onSubmit.mock.calls[0]![0].meta as Record<string, unknown>;
    expect(meta.user).toBe('roy');
    expect(meta.action).toEqual({ type: 'submit' });   // 保留鍵未被覆蓋
    expect(meta.timestamp).not.toBe('HACKED');
  });
});

describe('button items', () => {
  const btn = (action: ButtonAction, extra?: Partial<ButtonItem>): FormConfig => ({
    version: 1,
    sections: [{
      id: 's1',
      rows: [{
        id: 'r1',
        items: [
          { id: 'f1', kind: 'field', key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
          { id: 'f2', kind: 'field', key: 'note', label: 'Note', component: 'Input', dataType: 'string', defaultValue: 'keep' },
          { id: 'b1', kind: 'button', label: 'Go', action, ...extra },
        ],
      }],
    }],
  });

  it('renders configured buttons and suppresses the default submit', () => {
    render(<ConfigForm config={btn({ type: 'custom', name: 'x' })} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^submit$/i })).toBeNull();
  });

  it('submit button validates by default and blocks invalid submit', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={btn({ type: 'submit' })} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(screen.getByText(/required|expected|invalid/i)).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submit button with valid values emits the envelope with action.type submit', async () => {
    const onSubmit = vi.fn();
    render(<ConfigForm config={btn({ type: 'submit' })} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Roy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].meta.action).toEqual({ type: 'submit' });
  });

  it('custom button skips validation by default and calls onAction with the envelope', async () => {
    const onAction = vi.fn();
    render(<ConfigForm config={btn({ type: 'custom', name: 'save-draft' })} onSubmit={vi.fn()} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));   // name 空著也能發(不驗)
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    const [name, payload] = onAction.mock.calls[0]!;
    expect(name).toBe('save-draft');
    expect(payload.meta.action).toEqual({ type: 'custom', name: 'save-draft' });
    expect(payload.meta.valid).toBe(false);   // meta 照實回報
  });

  it('custom button with validate: true blocks when invalid', async () => {
    const onAction = vi.fn();
    render(<ConfigForm config={btn({ type: 'custom', name: 'x' }, { validate: true })} onSubmit={vi.fn()} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(screen.getByText(/required|expected|invalid/i)).toBeTruthy());
    expect(onAction).not.toHaveBeenCalled();
  });

  it('clear resets only the listed fields', async () => {
    render(<ConfigForm config={btn({ type: 'clear', fields: ['name'] })} onSubmit={vi.fn()} defaultValues={{ name: 'Roy', note: 'keep' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('keep');
  });

  it('reset restores defaultValues', async () => {
    render(<ConfigForm config={btn({ type: 'reset' })} onSubmit={vi.fn()} defaultValues={{ name: 'init', note: 'keep' }} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('init'));
  });

  describe('api action', () => {
    const apiCfg = (over?: Partial<Extract<ButtonAction, { type: 'api' }>>) =>
      btn({ type: 'api', url: '/api/echo', ...over });

    it('sends { url, method, body: { data, meta } } through the injected fetcher', async () => {
      const fetcher = vi.fn().mockResolvedValue({ ok: true });
      render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} fetcher={fetcher} defaultValues={{ name: 'Roy', note: 'n' }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      const req = fetcher.mock.calls[0]![0];
      expect(req.url).toBe('/api/echo');
      expect(req.method).toBe('POST');
      expect(req.body.data).toEqual({ name: 'Roy', note: 'n' });
      expect(req.body.meta.action).toEqual({ type: 'api' });
    });

    it('fields narrows the sent data', async () => {
      const fetcher = vi.fn().mockResolvedValue({});
      render(<ConfigForm config={apiCfg({ fields: ['name'] })} onSubmit={vi.fn()} fetcher={fetcher} defaultValues={{ name: 'Roy', note: 'n' }} />);
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
      expect(fetcher.mock.calls[0]![0].body.data).toEqual({ name: 'Roy' });
    });

    it('success: shows message, maps response into fields, reports via onAction', async () => {
      const fetcher = vi.fn().mockResolvedValue({ result: { display: 'mapped!' } });
      const onAction = vi.fn();
      render(
        <ConfigForm
          config={apiCfg({ responseMap: { 'result.display': 'note', 'missing.path': 'name' } })}
          onSubmit={vi.fn()} onAction={onAction} fetcher={fetcher} defaultValues={{ name: 'keep', note: '' }}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      await waitFor(() => expect(screen.getByText(/success/i)).toBeTruthy());
      expect((screen.getByLabelText('Note') as HTMLInputElement).value).toBe('mapped!');
      expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('keep');   // 取不到 → 跳過
      expect(onAction).toHaveBeenCalledWith('api', expect.objectContaining({ response: { result: { display: 'mapped!' } } }));
    });

    it('failure: shows error message and reports apiError via onAction', async () => {
      const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
      const onAction = vi.fn();
      render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} onAction={onAction} fetcher={fetcher} />);
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));
      await waitFor(() => expect(screen.getByText(/failed/i)).toBeTruthy());
      const payload = onAction.mock.calls[0]![1];
      expect(payload.meta.apiError).toBe('boom');
      expect(payload.response).toBeUndefined();
    });

    it('pending: button disabled while in flight', async () => {
      let resolve!: (v: unknown) => void;
      const fetcher = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
      render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} fetcher={fetcher} />);
      const button = screen.getByRole('button', { name: 'Go' });
      fireEvent.click(button);
      await waitFor(() => expect(button).toHaveProperty('disabled', true));
      resolve({});
      await waitFor(() => expect(button).toHaveProperty('disabled', false));
    });

    it('no fetcher: api button renders disabled', () => {
      render(<ConfigForm config={apiCfg()} onSubmit={vi.fn()} />);
      expect(screen.getByRole('button', { name: 'Go' })).toHaveProperty('disabled', true);
    });

    it('config change while in flight resets pending state and drops the late result', async () => {
      let resolve!: (v: unknown) => void;
      const fetcher = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
      const onAction = vi.fn();
      const cfg1 = apiCfg();
      const { rerender } = render(
        <ConfigForm config={cfg1} onSubmit={vi.fn()} onAction={onAction} fetcher={fetcher} />,
      );
      const button = screen.getByRole('button', { name: 'Go' });
      fireEvent.click(button);
      await waitFor(() => expect(button).toHaveProperty('disabled', true));

      // Swap config mid-flight (different object identity, extra field) — simulates
      // a parent re-render (e.g. wizard step change) while the api call is in flight.
      const cfg2: FormConfig = {
        ...cfg1,
        sections: [{
          ...cfg1.sections![0]!,
          rows: [{
            ...cfg1.sections![0]!.rows[0]!,
            items: [
              ...cfg1.sections![0]!.rows[0]!.items,
              { id: 'f3', kind: 'field', key: 'extra', label: 'Extra', component: 'Input', dataType: 'string' },
            ],
          }],
        }],
      };
      rerender(<ConfigForm config={cfg2} onSubmit={vi.fn()} onAction={onAction} fetcher={fetcher} />);

      // pending state must be cleared by the config-change effect — button re-enabled.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Go' })).toHaveProperty('disabled', false));

      // Late resolution must be dropped: no onAction, no success message.
      await act(async () => {
        resolve({});
        await new Promise((r) => setTimeout(r, 0));
      });
      expect(onAction).not.toHaveBeenCalled();
      expect(screen.queryByText(/success/i)).toBeNull();
    });
  });
});
