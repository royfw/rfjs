import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Select, SelectTrigger, SelectValue } from './select';

describe('Select', () => {
  it('renders the trigger with a placeholder', () => {
    render(
      <Select>
        <SelectTrigger aria-label="kind">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole('combobox', { name: 'kind' });
    expect(trigger).toBeDefined();
    expect(trigger.getAttribute('data-slot')).toBe('select-trigger');
    expect(screen.getByText('Choose')).toBeDefined();
  });

  it('applies the size data attribute', () => {
    render(
      <Select>
        <SelectTrigger aria-label="op" size="sm">
          <SelectValue placeholder="op" />
        </SelectTrigger>
      </Select>,
    );
    expect(screen.getByRole('combobox', { name: 'op' }).getAttribute('data-size')).toBe('sm');
  });
});
