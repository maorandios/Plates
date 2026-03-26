/** Padding around the plate (mm) so the outline is not flush to the canvas edge. */
export function previewMarginMm(plateW: number, plateH: number): number {
  const span = Math.max(plateW, plateH);
  return Math.min(150, Math.max(30, 0.12 * span));
}

/**
 * Batch workspace pan/zoom (`Group` scale). Wide range so users can zoom in on
 * small plates or zoom out for large layouts; cap avoids pathological values.
 */
export const BATCH_VIEWPORT_SCALE_MIN = 0.01;
export const BATCH_VIEWPORT_SCALE_MAX = 512;
