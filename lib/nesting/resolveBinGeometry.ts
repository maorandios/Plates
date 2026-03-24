/**
 * Inner nesting rectangle (mm) after edge margin — same convention as shelf / SVGNest bin.
 */

export function innerBinDimensionsMm(
  stockWidthMm: number,
  stockLengthMm: number,
  edgeMarginMm: number
): { innerWidthMm: number; innerLengthMm: number } | null {
  const m = Math.max(0, edgeMarginMm);
  const innerWidthMm = stockWidthMm - 2 * m;
  const innerLengthMm = stockLengthMm - 2 * m;
  if (innerWidthMm <= 0 || innerLengthMm <= 0) return null;
  return { innerWidthMm, innerLengthMm };
}
