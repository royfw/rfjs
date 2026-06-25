import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hello } from './index';

describe('@rfjs/form-builder-ui', () => {
  it('renders', () => {
    render(<Hello />);
    expect(screen.getByText('form-builder-ui')).toBeTruthy();
  });
});
