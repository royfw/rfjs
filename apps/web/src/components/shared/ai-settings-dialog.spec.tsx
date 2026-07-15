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
import { AI_SETTINGS_KEY } from '@rfjs/ai-assist';
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

  it('load models populates the datalist and shows the count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ id: 'local/qwen' }, { id: 'local/llama' }] }), {
          status: 200,
        }),
      ),
    );
    const { container } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.click(screen.getByRole('button', { name: /load models/i }));
    await waitFor(() => expect(screen.getByText(/2 models available/i)).toBeTruthy());
    const options = Array.from(
      document.querySelectorAll('datalist#ai-model-list option'),
      (o) => (o as HTMLOptionElement).value,
    );
    expect(options).toEqual(['local/llama', 'local/qwen']); // sorted
    expect(container).toBeTruthy();
  });

  it('load models failure shows the named error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('invalid key', { status: 401 })),
    );
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /load models/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/\[http\]/));
    expect(screen.getByText(/invalid key/i)).toBeTruthy();
  });

  it('test connection failure shows the named error with response detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('missing model', { status: 500 })),
    );
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://x/v1' } });
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-1' } });
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/connection failed/i));
    // Named error kind, not a generic line.
    expect(screen.getByRole('alert').textContent).toMatch(/\[http\]/);
    // Response body surfaced behind the collapsible details.
    expect(screen.getByText(/view details/i)).toBeTruthy();
    expect(screen.getByText(/missing model/i)).toBeTruthy();
  });
});
