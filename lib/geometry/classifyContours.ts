/**
 * Stage D — Contour classification: outer profile vs inner holes using containment
 * (largest area loop = outer; loops inside outer with representative point in polygon = holes).
 *
 * Contours outside the outer are discarded (single-part DXF expectation).
 */

import type { Point } from "./extract";
import { classifyContours as classifyByAreaAndContainment } from "./calc";

export interface ClassifiedPlateContours {
  outer: Point[];
  holes: Point[][];
  discardedOutsideOuter: Point[][];
}

/**
 * Classify closed loops into one outer boundary and inner cut-outs.
 */
export function classifyOuterAndInnerContours(
  closedLoops: Point[][]
): ClassifiedPlateContours {
  return classifyByAreaAndContainment(closedLoops);
}
