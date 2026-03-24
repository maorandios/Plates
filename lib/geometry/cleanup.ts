/**
 * Stage B — Geometry cleanup: units → mm, dedupe, gap merge, Clipper clean.
 *
 * Small **closed** loops are not removed here — they are classified as holes vs scrap
 * only after the outer contour is known (containment in {@link classifyContours}).
 */

import type { DiscardedSketchEntity } from "@/types";
import type { Point } from "./extract";
import { normalizeContours, detectUnitFactor } from "./normalize";

export interface GeometryCleanupResult {
  normalized: Point[][];
  discarded: DiscardedSketchEntity[];
  /** Reserved for degenerate rings if we surface them separately from normalize */
  removedFragmentRings: Point[][];
  warnings: string[];
  unitFactorApplied: number;
}

/**
 * Normalize to mm and clean polylines.
 */
export function cleanupContours(
  rawContours: Point[][],
  extractWarnings: string[]
): GeometryCleanupResult {
  const warnings = [...extractWarnings];
  const factor = detectUnitFactor(rawContours);
  if (factor === 25.4) {
    warnings.push(
      "Coordinates looked like inches; scaled to millimetres (×25.4)."
    );
  }

  const normalized = normalizeContours(rawContours, { unitFactor: factor });

  return {
    normalized,
    discarded: [],
    removedFragmentRings: [],
    warnings,
    unitFactorApplied: factor,
  };
}
