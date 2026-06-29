import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TagInput } from './tag-input';

describe('TagInput', () => {
  it('selects an option and emits string[]', async () => {
    const onChange = vi.fn();
    render(
      <TagInput value={[]} onChange={onChange} options={[{ label: 'Alpha', value: 'a' }]} />,
    );
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(await screen.findByText('Alpha'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('creatable: adds a free-typed tag on Enter', async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} creatable />);
    const box = screen.getByRole('textbox');
    await userEvent.type(box, 'custom{Enter}');
    expect(onChange).toHaveBeenCalledWith(['custom']);
  });

  it('renders selected values as removable chips', () => {
    render(
      <TagInput value={['a']} onChange={() => {}} options={[{ label: 'Alpha', value: 'a' }]} />,
    );
    expect(screen.getByText('Alpha')).toBeDefined();
  });
});
