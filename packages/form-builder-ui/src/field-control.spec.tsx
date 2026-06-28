import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FieldControl, dateToISO, isoToDate } from './field-control';
import type { FieldConfig, DataSource, DataSourceFetcher } from '@rfjs/form-builder';

// jsdom shims for Radix UI components
beforeAll(() => {
  if (typeof Element !== 'undefined') {
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
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

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

  it('renders a numeric Input with type="number"', () => {
    const field: FieldConfig = { key: 'age', label: 'Age', component: 'Input', dataType: 'numeric' };
    const { container } = render(<FieldControl field={field} value="" onChange={() => {}} />);
    expect(container.querySelector('input[type="number"]')).toBeTruthy();
  });

  it('Number — renders a spinbutton and calls onChange on change', () => {
    const field: FieldConfig = { key: 'qty', label: 'Qty', component: 'Number', dataType: 'numeric' };
    const onChange = vi.fn();
    render(<FieldControl field={field} value="" onChange={onChange} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input).toBeTruthy();
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith('42');
  });

  it('Email — renders an input with type="email"', () => {
    const field: FieldConfig = { key: 'email', label: 'Email', component: 'Email', dataType: 'string' };
    const { container } = render(<FieldControl field={field} value="" onChange={() => {}} />);
    expect(container.querySelector('input[type="email"]')).toBeTruthy();
  });

  it('Switch — renders a switch role and calls onChange(true) then onChange(false)', () => {
    const field: FieldConfig = { key: 'active', label: 'Active', component: 'Switch', dataType: 'boolean' };
    const onChange = vi.fn();
    const { rerender } = render(<FieldControl field={field} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);

    onChange.mockClear();
    rerender(<FieldControl field={field} value={true} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('Radio — renders one radio per option and calls onChange with selected value', () => {
    const field: FieldConfig = {
      key: 'color',
      label: 'Color',
      component: 'Radio',
      dataType: 'string',
      options: [
        { label: 'Red', value: 'red' },
        { label: 'Blue', value: 'blue' },
      ],
    };
    const onChange = vi.fn();
    render(<FieldControl field={field} value="" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    fireEvent.click(radios[0]!);
    expect(onChange).toHaveBeenCalledWith('red');
  });

  it('DatePicker — renders a trigger button with placeholder when no value', () => {
    const field: FieldConfig = {
      key: 'dob',
      label: 'DOB',
      component: 'DatePicker',
      dataType: 'date',
      placeholder: 'Pick a date',
    };
    render(<FieldControl field={field} value="" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Pick a date');
  });

  it('DatePicker — renders trigger button showing the ISO date value', () => {
    const field: FieldConfig = {
      key: 'dob',
      label: 'DOB',
      component: 'DatePicker',
      dataType: 'date',
    };
    render(<FieldControl field={field} value="2024-03-15" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('2024-03-15');
  });
});

const ds: DataSource = {
  request: { url: 'http://example.com/api' },
  extract: { dialect: 'path', expr: 'items' },
  optionLabel: 'name',
  optionValue: 'id',
};

describe('FieldControl with dataSource', () => {
  it('Radio + dataSource + resolving fetcher → renders fetched options as radios after load', async () => {
    const fetcher: DataSourceFetcher = vi.fn().mockResolvedValue({
      items: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    });
    const field: FieldConfig = {
      key: 'choice',
      label: 'Choice',
      component: 'Radio',
      dataType: 'string',
      dataSource: ds,
    };
    render(<FieldControl field={field} value="" onChange={() => {}} fetcher={fetcher} />);
    await waitFor(() => expect(screen.getAllByRole('radio')).toHaveLength(2));
    expect(screen.getByLabelText('Alpha')).toBeTruthy();
    expect(screen.getByLabelText('Beta')).toBeTruthy();
  });

  it('Radio + dataSource + rejecting fetcher → shows fallback text', async () => {
    const fetcher: DataSourceFetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const field: FieldConfig = {
      key: 'choice',
      label: 'Choice',
      component: 'Radio',
      dataType: 'string',
      dataSource: { ...ds, fallback: '無可選項' },
    };
    render(<FieldControl field={field} value="" onChange={() => {}} fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText('無可選項')).toBeTruthy());
  });

  it('Radio + dataSource, ready but empty options → shows fallback', async () => {
    const fetcher: DataSourceFetcher = vi.fn().mockResolvedValue({ items: [] });
    const field: FieldConfig = {
      key: 'choice',
      label: 'Choice',
      component: 'Radio',
      dataType: 'string',
      dataSource: { ...ds, fallback: 'N/A' },
    };
    render(<FieldControl field={field} value="" onChange={() => {}} fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText('N/A')).toBeTruthy());
  });

  it('Radio without dataSource → static options unchanged', () => {
    const field: FieldConfig = {
      key: 'color',
      label: 'Color',
      component: 'Radio',
      dataType: 'string',
      options: [{ label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }],
    };
    render(<FieldControl field={field} value="" onChange={() => {}} />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByLabelText('Red')).toBeTruthy();
    expect(screen.getByLabelText('Blue')).toBeTruthy();
  });
});

describe('dateToISO / isoToDate (local-date, no UTC shift)', () => {
  it('dateToISO formats a local Date as yyyy-mm-dd', () => {
    expect(dateToISO(new Date(2026, 5, 28))).toBe('2026-06-28');
  });

  it('round-trips an ISO string through isoToDate → dateToISO unchanged', () => {
    expect(dateToISO(isoToDate('2026-06-28')!)).toBe('2026-06-28');
  });

  it('isoToDate returns undefined for empty/invalid input', () => {
    expect(isoToDate(undefined)).toBeUndefined();
    expect(isoToDate('')).toBeUndefined();
  });
});
