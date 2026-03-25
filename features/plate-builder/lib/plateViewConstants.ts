/** Padding around the plate (mm) so the outline is not flush to the canvas edge. */
export function previewMarginMm(plateW: number, plateH: number): number {
  const span = Math.max(plateW, plateH);
  return Math.min(150, Math.max(30, 0.12 * span));
}
