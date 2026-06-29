'use client';

import * as React from 'react';
import SignaturePadLib from 'signature_pad';

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
      onChange?.(pad.toDataURL());
    });

    return () => {
      resizeObserver.disconnect();
      pad.off();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div data-slot="signature-pad" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <canvas
        ref={canvasRef}
        style={{ border: '1px solid #e2e8f0', borderRadius: 6, width: '100%', height }}
      />
      <button type="button" onClick={handleClear} disabled={disabled}>
        Clear
      </button>
    </div>
  );
}
