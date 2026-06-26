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
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ConfigFormBuilder } from './config-form-builder';
import type { FormConfig } from '@rfjs/form-builder';

const empty: FormConfig = { version: 1, fields: [] };
const initial: FormConfig = { version: 1, fields: [{ key: 'name', label: 'Name', component: 'Input', dataType: 'string' }] };

describe('ConfigFormBuilder empty state', () => {
  it('shows the empty-state hint when there are no fields', () => {
    render(<ConfigFormBuilder initialConfig={empty} />);
    expect(screen.getByTestId('empty-state-hint')).toBeTruthy();
    expect(screen.getByText(/no fields yet/i)).toBeTruthy();
  });

  it('does not show the empty-state hint when fields are present', () => {
    render(<ConfigFormBuilder initialConfig={initial} />);
    expect(screen.queryByTestId('empty-state-hint')).toBeNull();
  });

  it('preview panel has a placeholder and no Submit when fields are empty', () => {
    render(<ConfigFormBuilder initialConfig={empty} />);
    const preview = screen.getByTestId('config-form-preview');
    expect(preview.textContent).toMatch(/preview will appear/i);
    expect(within(preview).queryByRole('button', { name: /submit/i })).toBeNull();
  });
});

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

  it('columns trigger renders the current columns value', () => {
    // Radix Select cannot be driven by fireEvent.change; assert the trigger shows current value.
    // The popover open+click interaction is unreliable in jsdom, so we assert trigger text only.
    render(<ConfigFormBuilder initialConfig={initial} />);
    const trigger = screen.getByLabelText(/columns/i);
    expect(trigger.textContent).toContain('1');
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
