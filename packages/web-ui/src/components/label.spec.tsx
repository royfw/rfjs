import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './label';

describe('Label', () => {
  it('renders its text', () => {
    render(<Label>Field name</Label>);
    expect(screen.getByText('Field name')).toBeDefined();
  });

  it('associates with a control via htmlFor', () => {
    render(<Label htmlFor="f">Name</Label>);
    expect(screen.getByText('Name').getAttribute('for')).toBe('f');
  });
});
