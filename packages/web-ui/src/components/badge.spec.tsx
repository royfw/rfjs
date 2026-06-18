import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renders its content with the data-slot', () => {
    render(<Badge>string</Badge>);
    const el = screen.getByText('string');
    expect(el).toBeDefined();
    expect(el.getAttribute('data-slot')).toBe('badge');
  });

  it('merges a custom className', () => {
    render(<Badge className="bg-intake/12">x</Badge>);
    expect(screen.getByText('x').className).toContain('bg-intake/12');
  });
});
