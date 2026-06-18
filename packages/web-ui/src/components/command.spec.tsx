import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Command, CommandGroup, CommandItem, CommandList } from './command';

describe('Command', () => {
  it('renders its items', () => {
    render(
      <Command>
        <CommandList>
          <CommandGroup>
            <CommandItem value="alpha">alpha</CommandItem>
            <CommandItem value="beta">beta</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );
    expect(screen.getByText('alpha')).toBeDefined();
    expect(screen.getByText('beta')).toBeDefined();
  });
});
