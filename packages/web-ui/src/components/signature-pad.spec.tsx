import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SignaturePad } from './signature-pad';

describe('SignaturePad', () => {
  it('renders a canvas and a clear button', () => {
    render(<SignaturePad />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeDefined();
  });

  it('clear empties and calls onClear', async () => {
    const onClear = vi.fn();
    render(<SignaturePad onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });

  it('disabled disables the clear button', () => {
    render(<SignaturePad disabled />);
    const btn = screen.getByRole('button', { name: /clear/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
