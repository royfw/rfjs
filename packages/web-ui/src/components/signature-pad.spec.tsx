import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignaturePad } from './signature-pad';

// Minimal signature_pad mock — lets us control endStroke event dispatch in tests.
const endStrokeListeners: Array<() => void> = [];
const mockPad = {
  addEventListener: (event: string, cb: () => void) => {
    if (event === 'endStroke') endStrokeListeners.push(cb);
  },
  toDataURL: () => 'data:image/png;base64,stub',
  clear: vi.fn(),
  off: vi.fn(),
  on: vi.fn(),
  penColor: '#000000',
};

vi.mock('signature_pad', () => ({ default: vi.fn(() => mockPad) }));

function fireEndStroke() {
  endStrokeListeners.forEach((cb) => cb());
}

describe('SignaturePad', () => {
  beforeEach(() => {
    endStrokeListeners.length = 0;
    mockPad.clear.mockClear();
  });

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

  it('endStroke calls the latest onChange after re-render (no stale closure)', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<SignaturePad onChange={first} />);
    // Replace onChange — the listener is still the one registered at mount.
    rerender(<SignaturePad onChange={second} />);
    fireEndStroke();
    expect(second).toHaveBeenCalledWith('data:image/png;base64,stub');
    expect(first).not.toHaveBeenCalled();
  });
});
