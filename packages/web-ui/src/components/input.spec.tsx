import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('renders an input and forwards type/placeholder', () => {
    render(<Input type="email" placeholder="email" />);
    const el = screen.getByPlaceholderText('email');
    expect(el).toBeDefined();
    expect(el.getAttribute('type')).toBe('email');
    expect(el.getAttribute('data-slot')).toBe('input');
  });

  it('merges className', () => {
    render(<Input className="font-mono" placeholder="x" />);
    expect(screen.getByPlaceholderText('x').className).toContain('font-mono');
  });

  it('calls onChange', () => {
    const onChange = vi.fn();
    render(<Input placeholder="x" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('x'), { target: { value: 'hi' } });
    expect(onChange).toHaveBeenCalled();
  });
});
