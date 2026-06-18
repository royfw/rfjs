import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea', () => {
  it('renders and forwards placeholder', () => {
    render(<Textarea placeholder="json" />);
    const el = screen.getByPlaceholderText('json');
    expect(el).toBeDefined();
    expect(el.getAttribute('data-slot')).toBe('textarea');
  });

  it('merges className and calls onChange', () => {
    const onChange = vi.fn();
    render(<Textarea className="font-mono" placeholder="x" onChange={onChange} />);
    const el = screen.getByPlaceholderText('x');
    expect(el.className).toContain('font-mono');
    fireEvent.change(el, { target: { value: 'a' } });
    expect(onChange).toHaveBeenCalled();
  });
});
