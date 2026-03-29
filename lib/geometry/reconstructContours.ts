/**
 * Stage C — Contour reconstruction: separate closed loops usable for classification
 * from open chains that could not be closed within tolerance.
 */

import { formatDecimal, formatInteger } from "@/lib/formatNumbers";
import type { DiscardedSketchEntity } from "@/types";
import type { Point } from "./extract";
import { isContourClosed } from "./validate";
import { POINT_TOLERANCE } from "./normalize";
import { polygonPerimeter } from "./calc";

export interface ReconstructContoursResult {
  closed: Point[][];
  /** Geometry of chains that stayed open (same order as discardedOpen meta) */
  openChains: Point[][];
  discardedOpen: DiscardedSketchEntity[];
  warnings: string[];
}

const DEFAULT_CLOSE_TOL = POINT_TOLERANCE * 10;

/**
 * Keep only geometrically closed contours; record open leftovers as discarded.
 */
export function reconstructClosedContours(
  contours: Point[][],
  closeToleranceMm: number = DEFAULT_CLOSE_TOL
): ReconstructContoursResult {
  const closed: Point[][] = [];
  const openChains: Point[][] = [];
  const discardedOpen: DiscardedSketchEntity[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < contours.length; i++) {
    const c = contours[i];
    if (c.length < 2) {
      openChains.push(c);
      discardedOpen.push({
        reason: "too_few_points",
        detail: `Contour ${i + 1}: insufficient vertices.`,
      });
      continue;
    }
    if (isContourClosed(c, closeToleranceMm)) {
      closed.push(c);
    } else {
      const len = polygonPerimeter(c);
      openChains.push(c);
      discardedOpen.push({
        reason: "open_chain",
        detail: `Open chain ${i + 1} (${c.length} pts, path ≈ ${formatDecimal(len, 2)} mm) — endpoints beyond ${formatDecimal(closeToleranceMm, 3)} mm snap.`,
      });
    }
  }

  if (discardedOpen.length > 0) {
    warnings.push(
      `${formatInteger(discardedOpen.length)} open or incomplete chain(s) were not promoted to closed contours.`
    );
  }

  return { closed, openChains, discardedOpen, warnings };
}
