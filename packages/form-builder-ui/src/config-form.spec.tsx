import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigForm } from './config-form';
import type { FormConfig, DataSource, UploadHandler, FileRef, SignatureTransport } from '@rfjs/form-builder';


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
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.not.objectContaining({ adminCode: expect.anything() }),
      ),
    );
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
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ doc: fileRef }),
    );
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
