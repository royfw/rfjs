import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

function Fixture({ value }: { value: string }) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value}>
          <DropdownMenuRadioItem value="legacy">legacy</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="jsonpath">jsonpath</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('DropdownMenuRadioItem', () => {
  it('exposes each option as a menuitemradio', () => {
    render(<Fixture value="legacy" />);
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
  });

  it('marks only the selected option aria-checked', () => {
    render(<Fixture value="jsonpath" />);
    const items = screen.getAllByRole('menuitemradio');
    const checked = items.filter((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]?.textContent).toContain('jsonpath');
  });
});
