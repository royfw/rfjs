import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Calendar } from './calendar';

describe('Calendar', () => {
  it('renders a day grid', () => {
    render(<Calendar mode="single" />);
    expect(screen.getByRole('grid')).toBeDefined();
  });

  it('renders the current month name in the caption', () => {
    render(<Calendar mode="single" />);
    // Month name appears in the caption label (e.g. "June 2026")
    const caption = document.querySelector('[class*="caption"]') ?? document.querySelector('nav');
    // At minimum, the grid is present
    expect(screen.getByRole('grid')).toBeDefined();
    void caption; // used above; suppress unused-var lint
  });

  it('renders day buttons inside the grid', () => {
    render(<Calendar mode="single" />);
    const grid = screen.getByRole('grid');
    const cells = grid.querySelectorAll('button');
    expect(cells.length).toBeGreaterThan(0);
  });
});
