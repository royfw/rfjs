import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignatureCapture } from './use-signature-capture';
import type { SignatureTransport, SignatureCaptureHandle } from '@rfjs/form-builder';

describe('useSignatureCapture', () => {
  it('stays idle when no transport is provided', () => {
    const { result } = renderHook(() => useSignatureCapture(undefined, 'sig'));
    expect(result.current.status).toBe('idle');
    expect(result.current.value).toBe('');
  });

  it('stays idle after calling start() when no transport is provided', () => {
    const { result } = renderHook(() => useSignatureCapture(undefined, 'sig'));
    act(() => { result.current.start(); });
    expect(result.current.status).toBe('idle');
  });

  it('goes pending then ready when transport resolves', async () => {
    const handle: SignatureCaptureHandle = {
      result: Promise.resolve('data:image/png;base64,xx'),
      cancel: vi.fn(),
    };
    const transport: SignatureTransport = vi.fn(() => handle);

    const { result } = renderHook(() => useSignatureCapture(transport, 'sig'));
    expect(result.current.status).toBe('idle');

    act(() => { result.current.start(); });
    // After start, pending synchronously
    expect(result.current.status).toBe('pending');

    // Await resolution
    await act(async () => {
      await handle.result;
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.value).toBe('data:image/png;base64,xx');
  });

  it('calls transport with fieldKey and a signal', () => {
    const handle: SignatureCaptureHandle = {
      result: new Promise(() => {}), // never resolves
      cancel: vi.fn(),
    };
    const transport: SignatureTransport = vi.fn(() => handle);

    const { result } = renderHook(() => useSignatureCapture(transport, 'my-sig'));
    act(() => { result.current.start(); });

    expect(transport).toHaveBeenCalledOnce();
    const [ctx] = (transport as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(ctx.fieldKey).toBe('my-sig');
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
  });

  it('cancel() calls handle.cancel() and resets to idle', async () => {
    const handle: SignatureCaptureHandle = {
      result: new Promise(() => {}), // never resolves
      cancel: vi.fn(),
    };
    const transport: SignatureTransport = vi.fn(() => handle);

    const { result } = renderHook(() => useSignatureCapture(transport, 'sig'));
    act(() => { result.current.start(); });
    expect(result.current.status).toBe('pending');

    act(() => { result.current.cancel(); });
    expect(handle.cancel).toHaveBeenCalledOnce();
    expect(result.current.status).toBe('idle');
  });

  it('ignores resolve after cancel (active-flag teardown)', async () => {
    let resolve!: (v: string) => void;
    const handle: SignatureCaptureHandle = {
      result: new Promise<string>((r) => { resolve = r; }),
      cancel: vi.fn(),
    };
    const transport: SignatureTransport = vi.fn(() => handle);

    const { result } = renderHook(() => useSignatureCapture(transport, 'sig'));
    act(() => { result.current.start(); });
    act(() => { result.current.cancel(); });

    // resolve after cancel — value must NOT be set
    await act(async () => { resolve('should-be-ignored'); });

    expect(result.current.value).toBe('');
    expect(result.current.status).toBe('idle');
  });

  it('calls handle.cancel() on unmount while pending', () => {
    const handle: SignatureCaptureHandle = {
      result: new Promise(() => {}),
      cancel: vi.fn(),
    };
    const transport: SignatureTransport = vi.fn(() => handle);

    const { result, unmount } = renderHook(() => useSignatureCapture(transport, 'sig'));
    act(() => { result.current.start(); });
    unmount();
    expect(handle.cancel).toHaveBeenCalledOnce();
  });

  it('uses subscribe to update status while pending (if subscribe present)', async () => {
    type Subscriber = (s: { status: 'idle' | 'pending' | 'ready' | 'error' }) => void;
    let subscriber!: Subscriber;
    const handle: SignatureCaptureHandle = {
      result: new Promise(() => {}),
      cancel: vi.fn(),
      subscribe: (cb: Subscriber) => {
        subscriber = cb;
        return () => {};
      },
    };
    const transport: SignatureTransport = vi.fn(() => handle);

    const { result } = renderHook(() => useSignatureCapture(transport, 'sig'));
    act(() => { result.current.start(); });
    expect(result.current.status).toBe('pending');

    // Transport fires 'error' via subscribe
    act(() => { subscriber({ status: 'error' }); });
    expect(result.current.status).toBe('error');
  });
});
