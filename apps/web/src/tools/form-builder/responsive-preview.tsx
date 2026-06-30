"use client";

import * as React from "react";
import { Button } from "@rfjs/web-ui/components/button";
import { Input } from "@rfjs/web-ui/components/input";
import { cn } from "@rfjs/web-ui/lib/utils";

// ---------------------------------------------------------------------------
// ResponsivePreview
// A width-constrained frame for previewing a form at device widths.
// ---------------------------------------------------------------------------

export interface ResponsivePreviewProps {
  children: React.ReactNode;
  width: number;
  onWidthChange: (w: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}

const MOBILE_WIDTH = 375;
const TABLET_WIDTH = 768;
const DEFAULT_MAX = 1280;
const DEFAULT_MIN = 320;

export function ResponsivePreview({
  children,
  width,
  onWidthChange,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  compact = false,
}: ResponsivePreviewProps): React.JSX.Element {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  const PRESETS = [
    { label: "Mobile", value: MOBILE_WIDTH },
    { label: "Tablet", value: TABLET_WIDTH },
    { label: "Desktop", value: max },
  ] as const;

  // Drag handle: right edge of the frame
  const dragRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

  function beginDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startWidth: width };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = ev.clientX - dragRef.current.startX;
      onWidthChange(clamp(dragRef.current.startWidth + delta));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function handleNumberInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    if (!isNaN(raw)) {
      onWidthChange(clamp(raw));
    }
  }

  function handleNumberBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    if (isNaN(raw)) {
      onWidthChange(clamp(width));
    } else {
      onWidthChange(clamp(raw));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Controls row */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          compact && "gap-1",
        )}
      >
        {/* Device presets */}
        {PRESETS.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="outline"
            size={compact ? "xs" : "sm"}
            onClick={() => onWidthChange(clamp(preset.value))}
            aria-pressed={width === preset.value}
            className={cn(
              "font-mono text-xs",
              width === preset.value && "border-blue-500 text-blue-600",
            )}
          >
            {preset.label}
          </Button>
        ))}

        <div className="flex items-center gap-2">
          {/* Range slider */}
          <input
            type="range"
            min={min}
            max={max}
            value={width}
            onChange={(e) => onWidthChange(clamp(parseInt(e.target.value, 10)))}
            className={cn(
              "w-28 accent-blue-500",
              compact && "w-20",
            )}
            aria-label="Preview width"
          />

          {/* Number input (spinbutton) */}
          <Input
            type="number"
            min={min}
            max={max}
            value={width}
            onChange={handleNumberInput}
            onBlur={handleNumberBlur}
            className={cn(
              "w-20 font-mono text-xs",
              compact && "w-16",
            )}
            aria-label="Preview width in pixels"
          />

          {/* Current-width label */}
          <span className={cn("font-mono text-xs text-muted-foreground", compact && "text-[11px]")}>
            {width}px
          </span>
        </div>
      </div>

      {/* Preview frame with right-drag handle */}
      <div className="relative overflow-hidden">
        {/* The constrained frame */}
        <div
          data-testid="rp-frame"
          className={cn("rounded-lg border border-border bg-background p-4 shadow-sm")}
          style={{ width: `${width}px`, maxWidth: "100%", margin: "0 auto" }}
        >
          {children}
        </div>

        {/* Right-edge drag handle — positioned over the right border of the frame */}
        <div
          aria-label="Resize width"
          onPointerDown={beginDrag}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            // offset to align with the right edge of the frame (centered in parent)
            right: `calc(50% - ${Math.min(width, 9999) / 2}px - 4px)`,
          }}
          className="flex w-3 cursor-col-resize touch-none items-center justify-center"
        >
          <div className="h-10 w-1 rounded-full bg-border hover:bg-blue-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}
