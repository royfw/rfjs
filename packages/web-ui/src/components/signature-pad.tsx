'use client';

import * as React from 'react';
import SignaturePadLib from 'signature_pad';

import { cn } from '../lib/utils';
import { Button } from './button';

export interface SignaturePadProps {
  value?: string; // data URL (controlled)
  onChange?: (dataUrl: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  penColor?: string;
  height?: number;
}

export function SignaturePad({
  value,
  onChange,
  onClear,
  disabled,
  penColor = '#000000',
  height = 200,
}: SignaturePadProps): React.JSX.Element {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const padRef = React.useRef<SignaturePadLib | null>(null);

  // Keep a ref to always call the latest onChange — avoids a stale closure in
  // the endStroke listener that is registered once in the [] init effect.
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Initialise the pad once (client-only — canvasRef is null during SSR).
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, { penColor });
    padRef.current = pad;

    // Scale for devicePixelRatio so strokes look crisp on HiDPI screens.
    const scaleCanvas = () => {
      const ratio = window.devicePixelRatio ?? 1;
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      ctx?.scale(ratio, ratio);
      pad.clear(); // clear resets internal state after resize
    };

    scaleCanvas();

    const resizeObserver = new ResizeObserver(scaleCanvas);
    resizeObserver.observe(canvas);

    pad.addEventListener('endStroke', () => {
      onChangeRef.current?.(pad.toDataURL());
    });

    return () => {
      resizeObserver.disconnect();
      pad.off();
    };
  }, []);

  // Sync penColor changes without recreating the pad.
  React.useEffect(() => {
    if (padRef.current) {
      padRef.current.penColor = penColor;
    }
  }, [penColor]);

  // Controlled clear: when the caller sets value to "" externally.
  React.useEffect(() => {
    if (value === '' && padRef.current) {
      padRef.current.clear();
    }
  }, [value]);

  // disabled: stop/resume the pad's pointer listeners.
  React.useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) {
      pad.off();
    } else {
      pad.on();
    }
  }, [disabled]);

  const handleClear = () => {
    padRef.current?.clear();
    onChange?.('');
    onClear?.();
  };

  return (
    <div data-slot="signature-pad" className={cn('flex flex-col gap-1')}>
      <canvas
        ref={canvasRef}
        className={cn('border border-input rounded-md w-full')}
        style={{ height }}
      />
      <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
        Clear
      </Button>
    </div>
  );
}
