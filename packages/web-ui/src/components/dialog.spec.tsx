import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';

describe('Dialog', () => {
  it('opens from the trigger and renders title/description/content', () => {
    render(
      <Dialog>
        <DialogTrigger>open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>desc</DialogDescription>
          <p>body</p>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByText('body')).toBeNull();
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('closes via the built-in close button', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>t</DialogTitle>
          <p>body</p>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByText('body')).toBeNull();
  });
});
