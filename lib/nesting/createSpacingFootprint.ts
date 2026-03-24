/**
 * Nesting collision footprint: outward offset of the cleaned outer contour by half the
 * part–part spacing rule (mm). Original outer stays unchanged for display/export.
 */

import type { NestPoint } from "./convertGeometryToSvgNest";
import { offsetClosedPathOutwardMm } from "./clipperFootprintOps";

/**
 * @param halfSpacingMm  Typically `spacingMm / 2` so two adjacent footprints yield a full gap.
 */
export function createSpacingFootprint(
  cleanedOuterRing: NestPoint[],
  halfSpacingMm: number
): NestPoint[] | null {
  const h = Math.max(0, halfSpacingMm);
  if (h <= 1e-9) {
    return cleanedOuterRing.map((p) => ({ x: p.x, y: p.y }));
  }
  return offsetClosedPathOutwardMm(cleanedOuterRing, h);
}
