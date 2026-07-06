"use client";

import * as React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getStraightPath,
  type EdgeProps,
  type Position,
} from "@xyflow/react";

/** 把手中心在此誤差內視為對齊 → 畫死直線(吸附感);超過才給弧線。 */
export const SNAP_EPS = 10;

export function adaptivePath(p: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
}): { path: string; labelX: number; labelY: number; straight: boolean } {
  const nearH = Math.abs(p.sourceY - p.targetY) <= SNAP_EPS;
  const nearV = Math.abs(p.sourceX - p.targetX) <= SNAP_EPS;
  if (nearH || nearV) {
    const [path, labelX, labelY] = getStraightPath({
      sourceX: p.sourceX,
      sourceY: p.sourceY,
      targetX: p.targetX,
      targetY: p.targetY,
    });
    return { path, labelX, labelY, straight: true };
  }
  const [path, labelX, labelY] = getBezierPath(p);
  return { path, labelX, labelY, straight: false };
}

/** 自適應連線:近水平/垂直吸成直線,大角度才用弧線;自帶 label 泡泡。 */
export function AdaptiveEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  style,
}: EdgeProps) {
  const { path, labelX, labelY } = adaptivePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd as string | undefined} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="absolute rounded border bg-background px-1 text-[10px] font-semibold text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "none" }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
