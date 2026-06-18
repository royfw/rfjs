import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders a checkbox role', () => {
    render(<Checkbox aria-label="include" />);
    expect(screen.getByRole('checkbox', { name: 'include' })).toBeDefined();
  });

  it('reflects the checked state', () => {
    render(<Checkbox aria-label="c" defaultChecked />);
    expect(screen.getByRole('checkbox', { name: 'c' }).getAttribute('data-state')).toBe('checked');
  });

  it('calls onCheckedChange on click', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="c" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'c' }));
    expect(onCheckedChange).toHaveBeenCalled();
  });
});
