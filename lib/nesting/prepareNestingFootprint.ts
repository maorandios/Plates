/**
 * Builds a **nesting-only** footprint: validate outer → spacing offset → optional simplify.
 * Display/export geometry (`NormalizedNestShape.outer`) is never modified here.
 */

import type { NestPoint } from "./convertGeometryToSvgNest";
import { createSpacingFootprint } from "./createSpacingFootprint";
import { preparePolygonFootprint } from "./preparePolygonFootprint";
import {
  simplifyNestingFootprint,
  type SimplifyNestingFootprintResult,
} from "./simplifyNestingFootprint";

export interface PrepareNestingFootprintOk {
  ok: true;
  nestingFootprintLocal: NestPoint[];
  spacedPointCountBeforeSimplify: number;
  simplify: SimplifyNestingFootprintResult | null;
}

export interface PrepareNestingFootprintFail {
  ok: false;
  reason: string;
}

export type PrepareNestingFootprintResult =
  | PrepareNestingFootprintOk
  | PrepareNestingFootprintFail;

/**
 * @param simplifyToleranceMm  0 disables simplification after offset.
 */
export function prepareNestingFootprintForPlacement(
  outer: NestPoint[],
  halfSpacingMm: number,
  simplifyToleranceMm: number
): PrepareNestingFootprintResult {
  const prep = preparePolygonFootprint(outer);
  if (!prep.ok) {
    return { ok: false, reason: prep.reason };
  }

  const spaced = createSpacingFootprint(prep.ring, halfSpacingMm);
  if (!spaced || spaced.length < 3) {
    return { ok: false, reason: "spacing_offset_failed" };
  }

  const spacedPointCountBeforeSimplify = spaced.length;
  if (simplifyToleranceMm > 0 && Number.isFinite(simplifyToleranceMm)) {
    const sim = simplifyNestingFootprint(spaced, simplifyToleranceMm);
    if (sim.simplifiedPointCount >= 3) {
      return {
        ok: true,
        nestingFootprintLocal: sim.ring,
        spacedPointCountBeforeSimplify,
        simplify: sim,
      };
    }
  }

  return {
    ok: true,
    nestingFootprintLocal: spaced.map((p) => ({ x: p.x, y: p.y })),
    spacedPointCountBeforeSimplify,
    simplify: null,
  };
}
