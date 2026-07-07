if (typeof Element !== "undefined") {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/messages/en.json';
import { AI_SETTINGS_KEY } from '@/lib/ai/settings';
import { AiSettingsDialog } from './ai-settings-dialog';

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={en as Record<string, unknown>}>
      <AiSettingsDialog />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('AiSettingsDialog', () => {
  it('opens from the trigger and saves settings to localStorage', async () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(AI_SETTINGS_KEY)!)).toEqual({
        baseUrl: 'http://x/v1',
        apiKey: 'sk-1',
        model: 'm',
      });
    });
  });

  it('test connection reports success via the client', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }),
      ),
    );
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(screen.getByText(/connection ok/i)).toBeTruthy());
  });

  it('test connection failure shows the error line', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { status: 500 })));
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/connection failed/i));
  });
});
