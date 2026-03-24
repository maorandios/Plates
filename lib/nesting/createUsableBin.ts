/**
 * Usable nesting bin (mm) after stock edge margin — same model as shelf / SVGNest.
 */

import type { NestPoint } from "./convertGeometryToSvgNest";
import { innerBinDimensionsMm } from "./resolveBinGeometry";

export { innerBinDimensionsMm };

/** Axis-aligned inner bin as a closed CCW ring in bin coordinates (origin lower-left). */
export function usableBinPolygonMm(innerWidthMm: number, innerLengthMm: number): NestPoint[] {
  const w = innerWidthMm;
  const h = innerLengthMm;
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}
