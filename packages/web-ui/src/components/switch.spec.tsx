import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from './switch';

it('toggles via onCheckedChange', () => {
  const onCheckedChange = vi.fn();
  render(<Switch aria-label="x" checked={false} onCheckedChange={onCheckedChange} />);
  fireEvent.click(screen.getByRole('switch'));
  expect(onCheckedChange).toHaveBeenCalledWith(true);
});
