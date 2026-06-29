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
    await userEvent.click(screen.getByRole('button', { name: 'Open tag options' }));
    await userEvent.click(await screen.findByText('Alpha'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('creatable: adds a free-typed tag on Enter', async () => {
    const onChange = vi.fn();
    render(<TagInput value={[]} onChange={onChange} creatable />);
    await userEvent.click(screen.getByRole('button', { name: 'Open tag options' }));
    const input = await screen.findByRole('combobox');
    await userEvent.type(input, 'custom{Enter}');
    expect(onChange).toHaveBeenCalledWith(['custom']);
  });

  it('removes a chip and emits the remaining array', async () => {
    const onChange = vi.fn();
    render(
      <TagInput value={['a']} onChange={onChange} options={[{ label: 'Alpha', value: 'a' }]} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('disabled: onChange is not called when trigger is clicked', async () => {
    const onChange = vi.fn();
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        disabled
        options={[{ label: 'Alpha', value: 'a' }]}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open tag options' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
