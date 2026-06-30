/** 縮放係數:每次 zoomIn/zoomOut 乘以或除以此值。 */
export const ZOOM_FACTOR = 1.2;
/** 最小縮放倍率。 */
export const MIN_ZOOM = 0.2;
/** 最大縮放倍率。 */
export const MAX_ZOOM = 4;

/** 把縮放倍率限制在 [MIN_ZOOM, MAX_ZOOM]。 */
export const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** 以 current × factor 計算新倍率並 clamp。 */
export const zoomBy = (current: number, factor: number): number => clampZoom(current * factor);
