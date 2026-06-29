import * as React from 'react';
import type { SignatureTransport, SignatureCaptureHandle } from '@rfjs/form-builder';

export type SignatureCaptureStatus = 'idle' | 'pending' | 'ready' | 'error';

export interface SignatureCaptureState {
  status: SignatureCaptureStatus;
  value: string;
  start(): void;
  cancel(): void;
}

/**
 * Manages an optional transport-driven signature capture session.
 *
 * When `transport` is provided, calling `start()` opens a capture session
 * (e.g. a remote signature pad). The hook goes `idle → pending → ready|error`.
 * `cancel()` tears down the active session and returns to `idle`.
 *
 * When `transport` is **absent**, the hook stays permanently `idle` and the
 * `<SignaturePad>` component drives value directly via its `onChange` prop.
 *
 * Mirrors the `active`-flag teardown pattern used in `use-data-source.ts`:
 * late resolves after cancel or unmount are silently ignored.
 *
 * Consumers should memoize `transport` (e.g. `useCallback`) to avoid
 * unnecessary session restarts.
 */
export function useSignatureCapture(
  transport: SignatureTransport | undefined,
  fieldKey: string,
): SignatureCaptureState {
  const [status, setStatus] = React.useState<SignatureCaptureStatus>('idle');
  const [value, setValue] = React.useState('');

  // Keep a stable ref to the active handle so cancel() always reaches it.
  const handleRef = React.useRef<SignatureCaptureHandle | null>(null);
  // AbortController for the current session.
  const abortRef = React.useRef<AbortController | null>(null);

  // active flag — flipped false on cancel/unmount so late resolves are ignored.
  const activeRef = React.useRef(false);

  // Holds the unsubscribe function from handle.subscribe so teardown can
  // clean it up even if the result promise never settles.
  const unsubRef = React.useRef<(() => void) | undefined>(undefined);

  // Cleanup teardown — called by both cancel() and the unmount effect.
  const teardown = React.useCallback(() => {
    activeRef.current = false;
    unsubRef.current?.();
    unsubRef.current = undefined;
    handleRef.current?.cancel();
    handleRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // Unmount teardown.
  React.useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  const start = React.useCallback(() => {
    if (!transport) return; // no transport → local SignaturePad drives onChange

    // Tear down any previous session before starting a new one.
    teardown();

    const controller = new AbortController();
    abortRef.current = controller;
    activeRef.current = true;

    const handle = transport({ fieldKey, signal: controller.signal });
    handleRef.current = handle;

    setStatus('pending');

    // Subscribe to intermediate status updates (e.g. remote session lifecycle).
    if (handle.subscribe) {
      unsubRef.current = handle.subscribe((s) => {
        if (!activeRef.current) return;
        // Only update while still pending (ready is set by the result promise below).
        if (s.status === 'error') {
          setStatus('error');
        }
      });
    }

    handle.result
      .then((dataUrl) => {
        if (!activeRef.current) return;
        setValue(dataUrl);
        setStatus('ready');
      })
      .catch(() => {
        if (!activeRef.current) return;
        setStatus('error');
      });
  }, [transport, fieldKey, teardown]);

  const cancel = React.useCallback(() => {
    teardown();
    setStatus('idle');
    setValue('');
  }, [teardown]);

  return { status, value, start, cancel };
}
